# Customs Document Tracking Service

A JNIT Cloud Solutions proof of concept and proposed production platform for receiving, assigning, processing, tracking and returning customs-clearing document jobs through one controlled workflow.

The solution replaces scattered inboxes, spreadsheets and informal follow-ups with a shared operational record. Every submission receives a job reference and remains connected to its customer, documents, assigned agent, status, messages and audit history.

> **Project status:** The repository contains a functional proof of concept. It demonstrates the core portal, workflow API and AWS infrastructure. It is not yet the complete production application described in the solution proposal.

## The business problem

Customs-document work may arrive through multiple channels and pass between customers, office staff and clearing agents. Without one tracking process, teams can struggle to determine:

- Which documents have arrived?
- Who accepted each job?
- What is currently being processed?
- Which jobs are waiting for the customer?
- Did the customer receive the completed pack?
- Who changed a job, and when?

The proposed service makes the process visible, owned and auditable from submission to delivery.

## End-to-end workflow

```text
Portal / Email / WhatsApp Business
                |
                v
       Identify the customer
                |
                v
 Create job reference and audit event
                |
                v
 Incoming -> Agent accepts -> In progress
                                  |
                      +-----------+-----------+
                      |                       |
                      v                       v
            Awaiting documents           In review
                      |                       |
                      v                       v
            Customer uploads           Ready to send
                      |                       |
                      v                       v
            Same agent resumes       Approved delivery
                                              |
                                              v
                                          Completed
```

The key rule is that a request for further documents stays inside the existing job. The assigned agent remains the owner, the customer uploads against the same reference, and the job returns to that agent rather than becoming an unrelated item in the general queue.

See [the complete operational workflow](docs/workflow.md) for lifecycle rules, role responsibilities, customer matching, exception handling and delivery controls.

## Role-based platform

| Experience | Purpose |
|---|---|
| **Operations tracking board** | Displays queue totals, stages, owners, job age and exceptions for office visibility. |
| **Agent workspace** | Lets agents accept, process, request information, upload documents and complete work. |
| **Customer portal** | Lets customers upload, receive a reference, track progress, respond and retrieve completed documents. |
| **Management portal** | Provides team-wide visibility, reassignment, profiles, messages, audit history and reports. |
| **Administration** | Manages identities, roles, platform configuration and operational controls. |

## Workflow lifecycle

| Stage | Meaning |
|---|---|
| `incoming` | A new submission is waiting for acceptance. |
| `in_progress` | An agent owns and is processing the job. |
| `awaiting_documents` | The assigned agent is waiting for further customer documents. |
| `in_review` | Submitted or completed documents are being reviewed. |
| `ready_to_send` | The completed pack awaits approval or delivery. |
| `completed` | Processing and delivery are complete. |

Ambiguous submissions should enter a controlled manual-review queue instead of being matched automatically.

## What the current POC demonstrates

- Customer portal upload with an immediate `JNIT-YYMM-XXXXXX` reference
- Pre-signed S3 upload and download links
- Incoming, assigned and active-work queues
- Agent assignment, reassignment and status updates
- Additional and completed document uploads against an existing job
- Job-related customer messages
- Customer, employee and role profiles
- Operations, agent, customer, management and admin views
- Operational audit events
- Private S3 portal origin delivered through CloudFront
- Terraform-defined AWS infrastructure
- Cognito user-pool and role-group definitions

## POC versus complete application

| Capability | Current repository | Complete application |
|---|---|---|
| Portal upload | Demonstrated | Hardened, validated and tenant-isolated |
| Tracking board | Demonstrated | SLA timers, alerts, exceptions and reporting |
| Agent ownership | Demonstrated | Atomic acceptance, permissions and approval rules |
| Additional documents | Existing-job upload supported | Per-document checklists, reminders and notifications |
| Messaging | Basic contextual messages | Templates, delivery status and notification channels |
| Authentication | Terraform definitions included | Fully enforced role and customer access across every API |
| Email intake | Not implemented | SES ingestion into the common queue |
| WhatsApp intake | Not implemented | Official WhatsApp Business API integration |
| File security | Not implemented | Quarantine, validation and malware scanning |
| Completed delivery | Manual POC process | Approved-recipient delivery with evidence |
| Recovery and operations | Partial foundations | Alerts, backups, restore testing and support procedures |
| OCR and integrations | Deferred | Added only after the core workflow is proven |

## Customer matching and safe delivery

The complete platform identifies a customer using trusted signals such as portal authentication, an approved email address or domain, an approved WhatsApp number, and an existing job or shipment reference.

Completed documents must be returned to an authorised customer address—not blindly to an unknown sender. Unmatched or ambiguous submissions are held for manual review. These controls form part of the production design and are not represented as complete in the POC.

## AWS solution architecture

```text
Customer channels
Portal | Email | WhatsApp Business
              |
              v
CloudFront | API Gateway | SES
              |
              v
Lambda workflow | SQS | EventBridge
              |
       +------+------+-------+
       |             |       |
       v             v       v
      S3         DynamoDB  CloudWatch
   documents      records  monitoring
```

### Services currently represented in the repository

- Amazon CloudFront
- Amazon S3
- Amazon API Gateway
- AWS Lambda
- Amazon DynamoDB
- Amazon Cognito
- Amazon CloudWatch
- AWS IAM
- AWS Certificate Manager

SES, SQS and EventBridge are part of the wider production design for multichannel intake, resilient processing and notifications.

## Document organisation

```text
customers/<customer>/<job-reference>/
├── incoming/original-file.pdf
├── requested/additional-document.pdf
└── completed/approved-pack.pdf
```

For production, a stable customer ID should replace a name-derived path so records remain consistent if a customer name changes.

## Repository structure

```text
CUSTOMS-DOCUMENT-TRACKING-SERVICE/
├── backend/          Lambda workflow API
├── docs/             Workflow and production-delivery documentation
├── infrastructure/   Terraform AWS definitions
├── portal/           Role-based web application
└── README.md          Product overview
```

## If the customer approves the solution

The POC should become the validated starting point—not be treated as production-ready. Delivery would proceed through:

1. **Discovery and workflow confirmation** — agree channels, statuses, roles, customer matching, SLAs, volumes, retention and pilot scope.
2. **Production architecture and security** — complete tenant isolation, authorisation, file quarantine, malware scanning, encryption, monitoring, backup and recovery design.
3. **Core workflow build** — harden job creation, atomic assignment, document requests, checklists, approvals, audit history and reporting.
4. **Channel integrations** — implement customer portal and email first; add WhatsApp Business when approved and operationally justified.
5. **Testing and migration** — security, workflow, recovery, performance and user-acceptance testing using approved sample documents.
6. **Pilot and training** — launch with selected staff and customers, monitor outcomes and correct workflow gaps.
7. **Production rollout** — expand users and channels only after pilot acceptance.

The first pilot should prove that every submission is traceable, every active job has an owner, staff and customers see the correct state, and completed work has delivery evidence.

## POC deployment

1. Authenticate the AWS provider using an approved AWS profile or environment.
2. Open the `infrastructure` directory.
3. Copy `terraform.tfvars.example` to `terraform.tfvars` if custom values are required.
4. Run `terraform init`.
5. Run `terraform plan` and review every proposed resource.
6. Run `terraform apply` only after approval.
7. Open the `portal_url` output.

Default AWS Region: `af-south-1`.

## Planned JNIT endpoints

- `track.jnit.co.za`
- `agents.jnit.co.za`
- `customers.jnit.co.za`
- `admin.jnit.co.za`
- `api.jnit.co.za`

These are design targets, not a statement that every endpoint is live.

## Product roadmap

### First production-focused release

- Customer portal and dedicated email intake
- Incoming and processing queues
- Agent acceptance and controlled reassignment
- Office tracking board
- Customer and management experiences
- Document requests linked to the existing job
- Completion upload and secure delivery
- Audit history and basic reports
- Tenant isolation, monitoring, backups and recovery testing

### Later enhancements

- WhatsApp Business integration through the official API
- OCR and assisted document classification
- Tariff, customs, ERP or SARS integrations
- Advanced analytics and mobile access

AI is an enhancement—not a dependency for reliable tracking.

## Important notice

This repository is a proof of concept, not a production customs, legal or compliance system. Authentication, authorisation, tenant isolation, file scanning, privacy, retention, recovery and notification delivery must be fully tested and reviewed before real customer documents are processed.
