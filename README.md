# Customs Document Tracking Service

JNIT-branded proof of concept for receiving, assigning, tracking and returning customs-clearing document jobs.

## POC scope

- Customer portal upload with an immediate job reference
- Office tracking board with colour-coded queues
- Agent acceptance, employee attribution, document requests and completion
- Admin customer directory and audit view
- S3 document storage organised by customer and job reference
- DynamoDB jobs, customer and audit tables
- Lambda/API Gateway workflow API
- Private S3 portal origin delivered through CloudFront

Email (SES), WhatsApp, Cognito and custom domains are deliberately deferred until the upload workflow is proven.

## Deploy

1. Authenticate the AWS provider using your normal local AWS profile or environment.
2. Open `infrastructure`.
3. Copy `terraform.tfvars.example` to `terraform.tfvars` if custom values are needed.
4. Run `terraform init`.
5. Run `terraform plan` and review every resource.
6. Run `terraform apply` only after approval.
7. Use the `portal_url` output to test the application.

Default region: `af-south-1`.

## Planned JNIT subdomains

- `track.jnit.co.za`
- `agents.jnit.co.za`
- `customers.jnit.co.za`
- `admin.jnit.co.za`
- `api.jnit.co.za`
