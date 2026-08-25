# Complete Operational Workflow

This document describes the intended operating model behind the Customs Document Tracking Service and distinguishes the current proof of concept from the complete application proposed to the customer.

## 1. Intake

The target platform brings three channels into one controlled queue:

1. **Customer portal** — an authenticated customer uploads documents directly.
2. **Dedicated email** — controlled mailboxes capture messages, attachments and sender details.
3. **WhatsApp Business** — the official business API receives messages and media. Personal WhatsApp automation is excluded.

The POC currently demonstrates portal intake. Email and WhatsApp intake remain production roadmap items.

Each submission should record its job reference, customer ID, source, sender, authorised return channel, received time and original-file metadata.

## 2. Customer identification

Before routing or returning documents, the system matches the submission using trusted signals:

- Authenticated portal account
- Approved email address or domain
- Approved WhatsApp number
- Existing job or shipment reference

If the signals are insufficient or conflicting, the submission enters manual review. The system must not guess the customer or send completed documents to an unverified recipient.

## 3. Job creation

For a portal submission, the POC API:

1. Validates the required fields.
2. Generates a unique job reference.
3. Creates an `incoming` record.
4. Builds the S3 storage key.
5. Returns a time-limited upload URL.
6. Writes a job-created audit event.

The customer receives the reference immediately and uses it throughout the process.

## 4. Acceptance and ownership

A new job appears in the Incoming queue. An agent accepts it, and the system records the owner and update time. The item then appears in that agent's active-work queue.

The complete application requires atomic assignment so two agents cannot accept the same job. Managers may reassign work, but the reason and actor must remain in the audit trail.

## 5. Processing lifecycle

```text
incoming
   |
   v
in_progress
   |
   +---------------------------+
   |                           |
   v                           v
awaiting_documents         in_review
   |                           |
   v                           v
customer uploads           ready_to_send
   |                           |
   v                           v
in_review                  completed
```

The final transition rules, permissions and SLA timers must be agreed during discovery. Status is controlled workflow data, not free text.

## 6. Requesting more documents

When an agent needs further information:

1. The agent requests named documents against the existing job.
2. The job reference and assigned agent remain attached.
3. The customer receives an action request through an approved channel.
4. The customer opens the secure link or signs in.
5. Uploaded files inherit the customer, job and document category.
6. The assigned agent is notified and resumes the same job.

The job does not return to the general Incoming queue. One reference preserves context, ownership and auditability.

The complete application can track each requested item separately—for example, a commercial invoice received while a certificate of origin remains outstanding. The POC supports additional uploads against an existing job but not yet the full checklist and reminder engine.

## 7. Completion and delivery

1. The agent uploads the completed pack.
2. The job moves to `ready_to_send` for approval if required.
3. The platform validates the authorised return recipient.
4. The pack is delivered using the approved channel.
5. Delivery outcome and timestamps are recorded.
6. The job moves to `completed`.

The POC supports completed-document upload and status changes. Automated approval, secure delivery and delivery confirmation still require implementation.

## 8. Role responsibilities

### Customer

- Submit a job and receive a reference
- Track progress and timeline
- Respond to document requests
- Send messages within the job
- Download completed files and view delivery history

### Agent

- Accept work
- Process assigned jobs
- Request additional documents
- Review returned documents
- Upload the completed pack
- Submit work for approval or delivery

### Manager

- Monitor all queues and job age
- Reassign work with a recorded reason
- Maintain customer and employee profiles
- Review messages, exceptions, audit history and reports

### Administrator

- Manage identity, roles and platform settings
- Maintain operational and security controls
- Support monitoring, recovery and access reviews

## 9. Records and audit

- **S3** stores incoming, requested and completed files.
- **DynamoDB jobs** stores status, ownership and timestamps.
- **Customer and user records** hold operational identities and authorised contacts.
- **Messages** remain linked to job references.
- **Audit events** record important actions in sequence.

Production audit events should cover intake, acceptance, reassignment, status changes, requests, uploads, approvals, delivery attempts and completion.

## 10. Exceptions

The complete application must visibly handle:

- Customer cannot be matched safely
- Unsupported, suspicious or infected file
- Duplicate submission
- Concurrent acceptance attempts
- Failed or expired upload
- Undeliverable notification
- Incomplete requested-document set
- Failed approval or completed-pack delivery
- Asynchronous processing failure

No exception should silently disappear from the operational workflow.

## 11. Production controls

Before real customer use, validate:

- Tenant isolation
- Role-based API permissions
- Encryption in transit and at rest
- File quarantine and malware scanning
- Time-limited file access
- S3 versioning and retention
- Backups and tested restoration
- Monitoring, alerts and failed-event handling
- Audit-log access and retention
- Privacy and deletion requirements

## 12. Delivery phases after approval

### Phase 1 — Discovery

Confirm real channels, users, volumes, statuses, permissions, SLAs, return rules, retention, recovery objectives and pilot boundaries.

### Phase 2 — Production foundation

Finalise architecture, environments, identity, tenant isolation, security controls, CI/CD, monitoring, backup and recovery.

### Phase 3 — Core application

Harden portal intake, assignment, processing, requested-document checklists, messaging, approvals, delivery and audit reporting.

### Phase 4 — Channel integration

Implement dedicated email intake and notification delivery. Add official WhatsApp Business integration only after channel requirements and costs are approved.

### Phase 5 — Verification

Perform automated, security, workflow, recovery, performance and user-acceptance testing using approved sample data.

### Phase 6 — Pilot

Train selected users, run controlled customer jobs, measure ownership and delivery outcomes, and correct workflow gaps.

### Phase 7 — Production rollout

Approve operational support, expand users and customers, and introduce later integrations only after the pilot succeeds.

## 13. Pilot gate

The pilot should prove:

1. Every received submission becomes a traceable job.
2. Every active job has a visible owner.
3. Staff and customers see the correct current state.
4. Additional documents return to the correct job and agent.
5. Completed work has authorised delivery and audit evidence.

OCR, AI and external customs integrations should follow—not precede—proof of this core workflow.
