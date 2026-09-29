#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export AWS_PROFILE="${AWS_PROFILE:-CPS}"
REGION="${AWS_REGION:-eu-west-3}"
ROLE_NAME=sol-itinerary-voucher-mail-role
FN=sol-itinerary-voucher-mail
APP_ORIGIN="${APP_ORIGIN:-https://master.d32z4rqkhd384i.amplifyapp.com}"

unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy ALL_PROXY all_proxy 2>/dev/null || true

echo "AWS identity:"
aws sts get-caller-identity

echo "Packaging Lambda..."
(cd "$ROOT/lambda/voucher-mail" && npm install --omit=dev --silent)
rm -f /tmp/sol-voucher-mail.zip
(cd "$ROOT/lambda/voucher-mail" && zip -r /tmp/sol-voucher-mail.zip index.mjs node_modules -q)

if ! aws iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1; then
  echo "Creating IAM role $ROLE_NAME..."
  aws iam create-role --role-name "$ROLE_NAME" \
    --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
  aws iam attach-role-policy --role-name "$ROLE_NAME" \
    --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
  echo "Waiting for IAM propagation..."
  sleep 15
fi

ROLE_ARN=$(aws iam get-role --role-name "$ROLE_NAME" --query 'Role.Arn' --output text)

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

: "${RESEND_API_KEY:?RESEND_API_KEY required in .env}"
: "${VOUCHER_FROM:?VOUCHER_FROM required in .env}"
: "${APP_ORIGIN:?APP_ORIGIN required in .env}"

export APP_ORIGIN VOUCHER_FROM RESEND_API_KEY
ENV_JSON=$(node -e "console.log(JSON.stringify({Variables:{RESEND_API_KEY:process.env.RESEND_API_KEY,APP_ORIGIN:process.env.APP_ORIGIN,VOUCHER_FROM:process.env.VOUCHER_FROM,ALLOWED_ORIGIN:process.env.APP_ORIGIN}}))")

if aws lambda get-function --function-name "$FN" --region "$REGION" >/dev/null 2>&1; then
  echo "Updating Lambda $FN..."
  aws lambda update-function-code --function-name "$FN" --region "$REGION" --zip-file fileb:///tmp/sol-voucher-mail.zip >/dev/null
  aws lambda wait function-updated --function-name "$FN" --region "$REGION"
  aws lambda update-function-configuration --function-name "$FN" --region "$REGION" --environment "$ENV_JSON" --timeout 30 >/dev/null
  aws lambda wait function-updated --function-name "$FN" --region "$REGION"
else
  echo "Creating Lambda $FN..."
  aws lambda create-function --function-name "$FN" --region "$REGION" \
    --runtime nodejs20.x --handler index.handler \
    --role "$ROLE_ARN" \
    --zip-file fileb:///tmp/sol-voucher-mail.zip \
    --timeout 30 \
    --environment "$ENV_JSON" >/dev/null
  aws lambda wait function-active --function-name "$FN" --region "$REGION"
fi

if ! aws lambda get-function-url-config --function-name "$FN" --region "$REGION" >/dev/null 2>&1; then
  echo "Creating Function URL..."
  aws lambda create-function-url-config --function-name "$FN" --region "$REGION" \
    --auth-type NONE \
    --cors "{\"AllowOrigins\":[\"$APP_ORIGIN\",\"http://localhost:5173\"],\"AllowMethods\":[\"*\"],\"AllowHeaders\":[\"content-type\"],\"MaxAge\":86400}" >/dev/null
  aws lambda add-permission --function-name "$FN" --region "$REGION" \
    --statement-id FunctionURLAllowPublicAccess \
    --action lambda:InvokeFunctionUrl \
    --principal '*' \
    --function-url-auth-type NONE >/dev/null 2>&1 || true
fi

FN_URL=$(aws lambda get-function-url-config --function-name "$FN" --region "$REGION" --query 'FunctionUrl' --output text 2>/dev/null || true)
MAIL_API_URL="$FN_URL"

# Function URLs may return 403 when account blocks public URL access — use HTTP API.
if [[ -z "$MAIL_API_URL" ]] || ! curl -sf -o /dev/null -m 5 -X OPTIONS "$MAIL_API_URL" 2>/dev/null; then
  echo "Function URL unavailable or blocked — creating API Gateway HTTP API..."
  FN_ARN=$(aws lambda get-function --function-name "$FN" --region "$REGION" --query 'Configuration.FunctionArn' --output text)
  API_ID=$(aws apigatewayv2 create-api --name sol-voucher-mail --protocol-type HTTP --region "$REGION" --query 'ApiId' --output text)
  INTEGRATION_ID=$(aws apigatewayv2 create-integration --api-id "$API_ID" --region "$REGION" \
    --integration-type AWS_PROXY --integration-uri "$FN_ARN" --payload-format-version 2.0 \
    --query 'IntegrationId' --output text)
  aws apigatewayv2 create-route --api-id "$API_ID" --region "$REGION" --route-key 'POST /' --target "integrations/$INTEGRATION_ID" >/dev/null
  aws apigatewayv2 create-route --api-id "$API_ID" --region "$REGION" --route-key 'OPTIONS /' --target "integrations/$INTEGRATION_ID" >/dev/null
  aws apigatewayv2 create-stage --api-id "$API_ID" --region "$REGION" --stage-name '$default' --auto-deploy >/dev/null
  aws apigatewayv2 update-api --api-id "$API_ID" --region "$REGION" \
    --cors-configuration "{\"AllowOrigins\":[\"$APP_ORIGIN\",\"http://localhost:5173\"],\"AllowMethods\":[\"POST\",\"OPTIONS\"],\"AllowHeaders\":[\"content-type\"],\"MaxAge\":86400}" >/dev/null
  aws lambda add-permission --function-name "$FN" --region "$REGION" \
    --statement-id "apigw-${API_ID}" --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:${REGION}:352374931426:${API_ID}/*/*" >/dev/null 2>&1 || true
  MAIL_API_URL="$(aws apigatewayv2 get-api --api-id "$API_ID" --region "$REGION" --query 'ApiEndpoint' --output text)/"
fi

echo ""
echo "Mail API URL:"
echo "$MAIL_API_URL"

APP_ID=d32z4rqkhd384i
echo ""
echo "Updating Amplify build spec and environment variables..."
aws amplify update-app --app-id "$APP_ID" --region "$REGION" \
  --build-spec "file://$ROOT/amplify.yml" \
  --environment-variables "VOUCHER_MAIL=resend,VOUCHER_MAIL_API_URL=${MAIL_API_URL},APP_ORIGIN=${APP_ORIGIN},VOUCHER_FROM=${VOUCHER_FROM}" >/dev/null

echo "Triggering Amplify rebuild on master..."
JOB_ID=$(aws amplify start-job --app-id "$APP_ID" --branch-name master --job-type RELEASE --region "$REGION" --query 'jobSummary.jobId' --output text)
echo "Amplify job started: $JOB_ID"
echo "Done."
