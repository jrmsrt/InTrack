
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "intrack": {
          Tables: {
            "academic_review_events": {
                  Row: {
                    "actor_id": string,"artifact_revision": number,"command_id": string,"created_at": string,"decision": string,"enrollment_id": string,"evaluation_id": string | null,"id": string,"journal_id": string | null,"portfolio_id": string | null,"reason": string,"reviewer_role": string,"task_id": string | null,"verification_snapshot": Json | null
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id": string,"artifact_revision": number,"command_id": string,"created_at"?: string,"decision": string,"enrollment_id": string,"evaluation_id"?: string | null,"id"?: string,"journal_id"?: string | null,"portfolio_id"?: string | null,"reason": string,"reviewer_role": string,"task_id"?: string | null,"verification_snapshot"?: Json | null
                  }
                  Update: {
                    "actor_id"?: string,"artifact_revision"?: number,"command_id"?: string,"created_at"?: string,"decision"?: string,"enrollment_id"?: string,"evaluation_id"?: string | null,"id"?: string,"journal_id"?: string | null,"portfolio_id"?: string | null,"reason"?: string,"reviewer_role"?: string,"task_id"?: string | null,"verification_snapshot"?: Json | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "academic_review_events_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "academic_review_events_enrollment_id_fkey"
      columns: ["enrollment_id"]
isOneToOne: false
      referencedRelation: "enrollments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "academic_review_events_evaluation_id_enrollment_id_fkey"
      columns: ["evaluation_id","enrollment_id"]
isOneToOne: false
      referencedRelation: "evaluation_versions"
      referencedColumns: ["id","enrollment_id"]
    },{
      foreignKeyName: "academic_review_events_journal_id_enrollment_id_fkey"
      columns: ["journal_id","enrollment_id"]
isOneToOne: false
      referencedRelation: "journal_versions"
      referencedColumns: ["id","enrollment_id"]
    },{
      foreignKeyName: "academic_review_events_portfolio_id_enrollment_id_fkey"
      columns: ["portfolio_id","enrollment_id"]
isOneToOne: false
      referencedRelation: "portfolio_versions"
      referencedColumns: ["id","enrollment_id"]
    },{
      foreignKeyName: "academic_review_events_task_id_enrollment_id_fkey"
      columns: ["task_id","enrollment_id"]
isOneToOne: false
      referencedRelation: "task_versions"
      referencedColumns: ["id","enrollment_id"]
    }
                  ]
                },"academic_terms": {
                  Row: {
                    "academic_year": string,"ends_on": string,"id": string,"semester": string,"starts_on": string
                  }
                  ComputedFields: never
                  Insert: {
                    "academic_year": string,"ends_on": string,"id"?: string,"semester": string,"starts_on": string
                  }
                  Update: {
                    "academic_year"?: string,"ends_on"?: string,"id"?: string,"semester"?: string,"starts_on"?: string
                  }
                  Relationships: [
                    
                  ]
                },"account_invitation_commands": {
                  Row: {
                    "actor_id": string,"command_id": string,"invitation_id": string,"request_payload": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id": string,"command_id": string,"invitation_id": string,"request_payload": NonNullable<Json>
                  }
                  Update: {
                    "actor_id"?: string,"command_id"?: string,"invitation_id"?: string,"request_payload"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "account_invitation_commands_actor_id_command_id_fkey"
      columns: ["actor_id","command_id"]
isOneToOne: true
      referencedRelation: "command_receipts"
      referencedColumns: ["actor_id","command_id"]
    },{
      foreignKeyName: "account_invitation_commands_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "account_invitation_commands_invitation_id_fkey"
      columns: ["invitation_id"]
isOneToOne: true
      referencedRelation: "account_invitations"
      referencedColumns: ["id"]
    }
                  ]
                },"account_invitations": {
                  Row: {
                    "accepted_at": string | null,"correlation_id": string,"created_at": string,"delivery_attempts": number,"eligible_student_id": string | null,"email": string,"expires_at": string | null,"id": string,"last_error_code": string | null,"membership_id": string,"profile_id": string,"requested_by": string,"revision": number,"sent_at": string | null,"state": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"correlation_id"?: string,"created_at"?: string,"delivery_attempts"?: number,"eligible_student_id"?: string | null,"email": string,"expires_at"?: string | null,"id"?: string,"last_error_code"?: string | null,"membership_id": string,"profile_id": string,"requested_by": string,"revision"?: number,"sent_at"?: string | null,"state"?: string
                  }
                  Update: {
                    "accepted_at"?: string | null,"correlation_id"?: string,"created_at"?: string,"delivery_attempts"?: number,"eligible_student_id"?: string | null,"email"?: string,"expires_at"?: string | null,"id"?: string,"last_error_code"?: string | null,"membership_id"?: string,"profile_id"?: string,"requested_by"?: string,"revision"?: number,"sent_at"?: string | null,"state"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "account_invitations_eligible_student_id_fkey"
      columns: ["eligible_student_id"]
isOneToOne: false
      referencedRelation: "eligible_students"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "account_invitations_membership_id_profile_id_fkey"
      columns: ["membership_id","profile_id"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["id","profile_id"]
    },{
      foreignKeyName: "account_invitations_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "account_invitations_requested_by_fkey"
      columns: ["requested_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"account_session_guards": {
                  Row: {
                    "not_before_epoch": number,"profile_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "not_before_epoch": number,"profile_id": string,"updated_at"?: string
                  }
                  Update: {
                    "not_before_epoch"?: number,"profile_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "account_session_guards_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"adviser_assignments": {
                  Row: {
                    "adviser_id": string,"assigned_by": string,"ends_at": string | null,"enrollment_id": string,"id": string,"starts_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "adviser_id": string,"assigned_by": string,"ends_at"?: string | null,"enrollment_id": string,"id"?: string,"starts_at"?: string
                  }
                  Update: {
                    "adviser_id"?: string,"assigned_by"?: string,"ends_at"?: string | null,"enrollment_id"?: string,"id"?: string,"starts_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "adviser_assignments_adviser_id_fkey"
      columns: ["adviser_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "adviser_assignments_assigned_by_fkey"
      columns: ["assigned_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "adviser_assignments_enrollment_id_fkey"
      columns: ["enrollment_id"]
isOneToOne: false
      referencedRelation: "enrollments"
      referencedColumns: ["id"]
    }
                  ]
                },"adviser_roster_details": {
                  Row: {
                    "membership_id": string,"phone": string,"revision": number,"sections": (string)[]
                  }
                  ComputedFields: never
                  Insert: {
                    "membership_id": string,"phone"?: string,"revision"?: number,"sections"?: (string)[]
                  }
                  Update: {
                    "membership_id"?: string,"phone"?: string,"revision"?: number,"sections"?: (string)[]
                  }
                  Relationships: [
                    {
      foreignKeyName: "adviser_roster_details_membership_id_fkey"
      columns: ["membership_id"]
isOneToOne: true
      referencedRelation: "memberships"
      referencedColumns: ["id"]
    }
                  ]
                },"announcements": {
                  Row: {
                    "archived_at": string | null,"audience_role": string | null,"author_id": string,"body": string,"id": string,"program_id": string,"published_at": string | null,"term_id": string | null,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"audience_role"?: string | null,"author_id": string,"body": string,"id"?: string,"program_id": string,"published_at"?: string | null,"term_id"?: string | null,"title": string
                  }
                  Update: {
                    "archived_at"?: string | null,"audience_role"?: string | null,"author_id"?: string,"body"?: string,"id"?: string,"program_id"?: string,"published_at"?: string | null,"term_id"?: string | null,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "announcements_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "announcements_program_id_fkey"
      columns: ["program_id"]
isOneToOne: false
      referencedRelation: "programs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "announcements_term_id_fkey"
      columns: ["term_id"]
isOneToOne: false
      referencedRelation: "academic_terms"
      referencedColumns: ["id"]
    }
                  ]
                },"attendance_attempts": {
                  Row: {
                    "action": string,"actor_id": string,"command_id": string,"enrollment_id": string,"gps_evidence": Json | null,"id": string,"reason_code": string,"received_at": string,"session_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id": string,"command_id": string,"enrollment_id": string,"gps_evidence"?: Json | null,"id"?: string,"reason_code": string,"received_at"?: string,"session_id"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string,"command_id"?: string,"enrollment_id"?: string,"gps_evidence"?: Json | null,"id"?: string,"reason_code"?: string,"received_at"?: string,"session_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "attendance_attempts_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attendance_attempts_enrollment_id_fkey"
      columns: ["enrollment_id"]
isOneToOne: false
      referencedRelation: "enrollments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attendance_attempts_session_id_enrollment_id_fkey"
      columns: ["session_id","enrollment_id"]
isOneToOne: false
      referencedRelation: "attendance_sessions"
      referencedColumns: ["id","enrollment_id"]
    }
                  ]
                },"attendance_exceptions": {
                  Row: {
                    "allowed_actions": (string)[],"decided_at": string | null,"decided_by": string | null,"decision_reason": string | null,"ends_at": string,"enrollment_id": string,"id": string,"kind": string,"placement_id": string,"reason": string,"requested_by": string,"revision": number,"starts_at": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "allowed_actions": (string)[],"decided_at"?: string | null,"decided_by"?: string | null,"decision_reason"?: string | null,"ends_at": string,"enrollment_id": string,"id"?: string,"kind": string,"placement_id": string,"reason": string,"requested_by": string,"revision"?: number,"starts_at": string,"status": string
                  }
                  Update: {
                    "allowed_actions"?: (string)[],"decided_at"?: string | null,"decided_by"?: string | null,"decision_reason"?: string | null,"ends_at"?: string,"enrollment_id"?: string,"id"?: string,"kind"?: string,"placement_id"?: string,"reason"?: string,"requested_by"?: string,"revision"?: number,"starts_at"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "attendance_exceptions_decided_by_fkey"
      columns: ["decided_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attendance_exceptions_enrollment_id_fkey"
      columns: ["enrollment_id"]
isOneToOne: false
      referencedRelation: "enrollments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attendance_exceptions_placement_id_enrollment_id_fkey"
      columns: ["placement_id","enrollment_id"]
isOneToOne: false
      referencedRelation: "placements"
      referencedColumns: ["id","enrollment_id"]
    },{
      foreignKeyName: "attendance_exceptions_requested_by_fkey"
      columns: ["requested_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"attendance_periods": {
                  Row: {
                    "approval_reference": string,"created_by": string,"ends_on": string,"enrollment_id": string,"id": string,"period_key": string,"starts_on": string
                  }
                  ComputedFields: never
                  Insert: {
                    "approval_reference": string,"created_by": string,"ends_on": string,"enrollment_id": string,"id"?: string,"period_key": string,"starts_on": string
                  }
                  Update: {
                    "approval_reference"?: string,"created_by"?: string,"ends_on"?: string,"enrollment_id"?: string,"id"?: string,"period_key"?: string,"starts_on"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "attendance_periods_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attendance_periods_enrollment_id_fkey"
      columns: ["enrollment_id"]
isOneToOne: false
      referencedRelation: "enrollments"
      referencedColumns: ["id"]
    }
                  ]
                },"attendance_session_revisions": {
                  Row: {
                    "actor_id": string,"command_id": string,"created_at": string,"enrollment_id": string,"frozen_snapshot": NonNullable<Json>,"id": string,"origin": string,"reason": string,"revision": number,"session_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id": string,"command_id": string,"created_at"?: string,"enrollment_id": string,"frozen_snapshot": NonNullable<Json>,"id"?: string,"origin": string,"reason": string,"revision": number,"session_id": string
                  }
                  Update: {
                    "actor_id"?: string,"command_id"?: string,"created_at"?: string,"enrollment_id"?: string,"frozen_snapshot"?: NonNullable<Json>,"id"?: string,"origin"?: string,"reason"?: string,"revision"?: number,"session_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "attendance_session_revisions_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attendance_session_revisions_enrollment_id_fkey"
      columns: ["enrollment_id"]
isOneToOne: false
      referencedRelation: "enrollments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attendance_session_revisions_session_id_enrollment_id_fkey"
      columns: ["session_id","enrollment_id"]
isOneToOne: false
      referencedRelation: "attendance_sessions"
      referencedColumns: ["id","enrollment_id"]
    }
                  ]
                },"attendance_sessions": {
                  Row: {
                    "attendance_date": string,"authority_snapshot": NonNullable<Json>,"clock_in_at": string,"clock_out_at": string | null,"enrollment_id": string,"gps_in": Json | null,"gps_out": Json | null,"id": string,"net_minutes": number | null,"original_clock_in_at": string,"original_clock_out_at": string | null,"placement_id": string,"policy_snapshot": NonNullable<Json>,"revision": number,"source": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attendance_date": string,"authority_snapshot": NonNullable<Json>,"clock_in_at": string,"clock_out_at"?: string | null,"enrollment_id": string,"gps_in"?: Json | null,"gps_out"?: Json | null,"id"?: string,"net_minutes"?: number | null,"original_clock_in_at": string,"original_clock_out_at"?: string | null,"placement_id": string,"policy_snapshot": NonNullable<Json>,"revision"?: number,"source"?: string,"status": string
                  }
                  Update: {
                    "attendance_date"?: string,"authority_snapshot"?: NonNullable<Json>,"clock_in_at"?: string,"clock_out_at"?: string | null,"enrollment_id"?: string,"gps_in"?: Json | null,"gps_out"?: Json | null,"id"?: string,"net_minutes"?: number | null,"original_clock_in_at"?: string,"original_clock_out_at"?: string | null,"placement_id"?: string,"policy_snapshot"?: NonNullable<Json>,"revision"?: number,"source"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "attendance_sessions_enrollment_id_fkey"
      columns: ["enrollment_id"]
isOneToOne: false
      referencedRelation: "enrollments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attendance_sessions_placement_id_enrollment_id_fkey"
      columns: ["placement_id","enrollment_id"]
isOneToOne: false
      referencedRelation: "placements"
      referencedColumns: ["id","enrollment_id"]
    }
                  ]
                },"audit_events": {
                  Row: {
                    "action": string,"actor_id": string | null,"after_revision": number | null,"before_revision": number | null,"command_id": string,"created_at": string,"details": NonNullable<Json>,"enrollment_id": string | null,"entity_id": string,"entity_type": string,"id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"after_revision"?: number | null,"before_revision"?: number | null,"command_id": string,"created_at"?: string,"details"?: NonNullable<Json>,"enrollment_id"?: string | null,"entity_id": string,"entity_type": string,"id"?: string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"after_revision"?: number | null,"before_revision"?: number | null,"command_id"?: string,"created_at"?: string,"details"?: NonNullable<Json>,"enrollment_id"?: string | null,"entity_id"?: string,"entity_type"?: string,"id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_events_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "audit_events_enrollment_id_fkey"
      columns: ["enrollment_id"]
isOneToOne: false
      referencedRelation: "enrollments"
      referencedColumns: ["id"]
    }
                  ]
                },"bootstrap_requests": {
                  Row: {
                    "command_id": string,"created_at": string,"display_name": string,"email": string,"invitation_id": string,"profile_id": string,"program_codes": (string)[],"reason": string
                  }
                  ComputedFields: never
                  Insert: {
                    "command_id": string,"created_at"?: string,"display_name": string,"email": string,"invitation_id": string,"profile_id": string,"program_codes": (string)[],"reason": string
                  }
                  Update: {
                    "command_id"?: string,"created_at"?: string,"display_name"?: string,"email"?: string,"invitation_id"?: string,"profile_id"?: string,"program_codes"?: (string)[],"reason"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "bootstrap_requests_invitation_id_fkey"
      columns: ["invitation_id"]
isOneToOne: true
      referencedRelation: "account_invitations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bootstrap_requests_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"class_join_attempts": {
                  Row: {
                    "attempted_at": string,"id": number,"profile_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempted_at"?: string,"id"?: never,"profile_id": string
                  }
                  Update: {
                    "attempted_at"?: string,"id"?: never,"profile_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "class_join_attempts_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"class_join_events": {
                  Row: {
                    "actor_id": string,"created_at": string,"decision": string,"id": string,"reason": string,"request_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id": string,"created_at"?: string,"decision": string,"id"?: string,"reason"?: string,"request_id": string
                  }
                  Update: {
                    "actor_id"?: string,"created_at"?: string,"decision"?: string,"id"?: string,"reason"?: string,"request_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "class_join_events_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_join_events_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "class_join_requests"
      referencedColumns: ["id"]
    }
                  ]
                },"class_join_requests": {
                  Row: {
                    "class_id": string,"id": string,"reason": string,"requested_at": string,"reviewed_at": string | null,"reviewed_by": string | null,"revision": number,"status": string,"student_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "class_id": string,"id"?: string,"reason"?: string,"requested_at"?: string,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"revision"?: number,"status"?: string,"student_id": string
                  }
                  Update: {
                    "class_id"?: string,"id"?: string,"reason"?: string,"requested_at"?: string,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"revision"?: number,"status"?: string,"student_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "class_join_requests_class_id_fkey"
      columns: ["class_id"]
isOneToOne: false
      referencedRelation: "practicum_classes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_join_requests_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "class_join_requests_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"clearance_events": {
                  Row: {
                    "actor_id": string,"basis_snapshot": NonNullable<Json>,"command_id": string,"created_at": string,"effective_at": string,"enrollment_id": string,"enrollment_revision": number,"id": string,"moa_submission_id": string | null,"placement_id": string,"reason": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id": string,"basis_snapshot": NonNullable<Json>,"command_id": string,"created_at"?: string,"effective_at"?: string,"enrollment_id": string,"enrollment_revision": number,"id"?: string,"moa_submission_id"?: string | null,"placement_id": string,"reason": string,"status": string
                  }
                  Update: {
                    "actor_id"?: string,"basis_snapshot"?: NonNullable<Json>,"command_id"?: string,"created_at"?: string,"effective_at"?: string,"enrollment_id"?: string,"enrollment_revision"?: number,"id"?: string,"moa_submission_id"?: string | null,"placement_id"?: string,"reason"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "clearance_events_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "clearance_events_enrollment_id_fkey"
      columns: ["enrollment_id"]
isOneToOne: false
      referencedRelation: "enrollments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "clearance_events_moa_submission_id_enrollment_id_fkey"
      columns: ["moa_submission_id","enrollment_id"]
isOneToOne: false
      referencedRelation: "submission_versions"
      referencedColumns: ["id","enrollment_id"]
    },{
      foreignKeyName: "clearance_events_placement_id_enrollment_id_fkey"
      columns: ["placement_id","enrollment_id"]
isOneToOne: false
      referencedRelation: "placements"
      referencedColumns: ["id","enrollment_id"]
    }
                  ]
                },"command_rate_windows": {
                  Row: {
                    "accepted": number,"actor_id": string,"window_start": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted": number,"actor_id": string,"window_start": string
                  }
                  Update: {
                    "accepted"?: number,"actor_id"?: string,"window_start"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "command_rate_windows_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"command_receipts": {
                  Row: {
                    "actor_id": string,"command_id": string,"created_at": string,"payload_hash": string,"result": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id": string,"command_id": string,"created_at"?: string,"payload_hash": string,"result": NonNullable<Json>
                  }
                  Update: {
                    "actor_id"?: string,"command_id"?: string,"created_at"?: string,"payload_hash"?: string,"result"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "command_receipts_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"companies": {
                  Row: {
                    "address": string,"archived_at": string | null,"contact_email": string | null,"contact_name": string | null,"id": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address": string,"archived_at"?: string | null,"contact_email"?: string | null,"contact_name"?: string | null,"id"?: string,"name": string
                  }
                  Update: {
                    "address"?: string,"archived_at"?: string | null,"contact_email"?: string | null,"contact_name"?: string | null,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"completion_summaries": {
                  Row: {
                    "command_id": string,"created_at": string,"enrollment_id": string,"enrollment_revision": number,"finalized_by": string,"id": string,"portfolio_id": string,"summary": NonNullable<Json>,"summary_hash": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "command_id": string,"created_at"?: string,"enrollment_id": string,"enrollment_revision": number,"finalized_by": string,"id"?: string,"portfolio_id": string,"summary": NonNullable<Json>,"summary_hash": string,"version": number
                  }
                  Update: {
                    "command_id"?: string,"created_at"?: string,"enrollment_id"?: string,"enrollment_revision"?: number,"finalized_by"?: string,"id"?: string,"portfolio_id"?: string,"summary"?: NonNullable<Json>,"summary_hash"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "completion_summaries_enrollment_id_fkey"
      columns: ["enrollment_id"]
isOneToOne: false
      referencedRelation: "enrollments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "completion_summaries_finalized_by_fkey"
      columns: ["finalized_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "completion_summaries_portfolio_id_enrollment_id_fkey"
      columns: ["portfolio_id","enrollment_id"]
isOneToOne: false
      referencedRelation: "portfolio_versions"
      referencedColumns: ["id","enrollment_id"]
    }
                  ]
                },"correction_requests": {
                  Row: {
                    "decided_at": string | null,"decided_by": string | null,"decision_reason": string | null,"enrollment_id": string,"evidence_document_id": string | null,"id": string,"original_revision": number,"original_snapshot": NonNullable<Json>,"proposed_snapshot": NonNullable<Json>,"reason": string,"requested_at": string,"requested_by": string,"revision": number,"session_id": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "decided_at"?: string | null,"decided_by"?: string | null,"decision_reason"?: string | null,"enrollment_id": string,"evidence_document_id"?: string | null,"id"?: string,"original_revision": number,"original_snapshot": NonNullable<Json>,"proposed_snapshot": NonNullable<Json>,"reason": string,"requested_at"?: string,"requested_by": string,"revision"?: number,"session_id": string,"status": string
                  }
                  Update: {
                    "decided_at"?: string | null,"decided_by"?: string | null,"decision_reason"?: string | null,"enrollment_id"?: string,"evidence_document_id"?: string | null,"id"?: string,"original_revision"?: number,"original_snapshot"?: NonNullable<Json>,"proposed_snapshot"?: NonNullable<Json>,"reason"?: string,"requested_at"?: string,"requested_by"?: string,"revision"?: number,"session_id"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "correction_requests_decided_by_fkey"
      columns: ["decided_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "correction_requests_enrollment_id_fkey"
      columns: ["enrollment_id"]
isOneToOne: false
      referencedRelation: "enrollments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "correction_requests_evidence_document_id_enrollment_id_fkey"
      columns: ["evidence_document_id","enrollment_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id","enrollment_id"]
    },{
      foreignKeyName: "correction_requests_requested_by_fkey"
      columns: ["requested_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "correction_requests_session_id_enrollment_id_fkey"
      columns: ["session_id","enrollment_id"]
isOneToOne: false
      referencedRelation: "attendance_sessions"
      referencedColumns: ["id","enrollment_id"]
    }
                  ]
                },"documents": {
                  Row: {
                    "bucket": string,"byte_count": number,"created_at": string,"enrollment_id": string,"id": string,"mime_type": string,"object_path": string,"original_name": string,"purpose": string,"requirement_id": string | null,"sha256": string | null,"status": string,"uploaded_by": string,"validated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "bucket"?: string,"byte_count": number,"created_at"?: string,"enrollment_id": string,"id"?: string,"mime_type": string,"object_path": string,"original_name": string,"purpose"?: string,"requirement_id"?: string | null,"sha256"?: string | null,"status"?: string,"uploaded_by": string,"validated_at"?: string | null
                  }
                  Update: {
                    "bucket"?: string,"byte_count"?: number,"created_at"?: string,"enrollment_id"?: string,"id"?: string,"mime_type"?: string,"object_path"?: string,"original_name"?: string,"purpose"?: string,"requirement_id"?: string | null,"sha256"?: string | null,"status"?: string,"uploaded_by"?: string,"validated_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "documents_enrollment_id_fkey"
      columns: ["enrollment_id"]
isOneToOne: false
      referencedRelation: "enrollments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "documents_requirement_id_enrollment_id_fkey"
      columns: ["requirement_id","enrollment_id"]
isOneToOne: false
      referencedRelation: "enrollment_requirements"
      referencedColumns: ["id","enrollment_id"]
    },{
      foreignKeyName: "documents_uploaded_by_fkey"
      columns: ["uploaded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"dtr_entries": {
                  Row: {
                    "dtr_id": string,"enrollment_id": string,"frozen_snapshot": NonNullable<Json>,"id": string,"session_id": string,"session_revision": number
                  }
                  ComputedFields: never
                  Insert: {
                    "dtr_id": string,"enrollment_id": string,"frozen_snapshot": NonNullable<Json>,"id"?: string,"session_id": string,"session_revision": number
                  }
                  Update: {
                    "dtr_id"?: string,"enrollment_id"?: string,"frozen_snapshot"?: NonNullable<Json>,"id"?: string,"session_id"?: string,"session_revision"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "dtr_entries_dtr_id_enrollment_id_fkey"
      columns: ["dtr_id","enrollment_id"]
isOneToOne: false
      referencedRelation: "dtr_versions"
      referencedColumns: ["id","enrollment_id"]
    },{
      foreignKeyName: "dtr_entries_enrollment_id_fkey"
      columns: ["enrollment_id"]
isOneToOne: false
      referencedRelation: "enrollments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "dtr_entries_session_id_enrollment_id_fkey"
      columns: ["session_id","enrollment_id"]
isOneToOne: false
      referencedRelation: "attendance_sessions"
      referencedColumns: ["id","enrollment_id"]
    }
                  ]
                },"dtr_review_events": {
                  Row: {
                    "actor_id": string,"command_id": string,"created_at": string,"decision": string,"dtr_id": string,"dtr_revision": number,"enrollment_id": string,"id": string,"reason": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id": string,"command_id": string,"created_at"?: string,"decision": string,"dtr_id": string,"dtr_revision": number,"enrollment_id": string,"id"?: string,"reason": string
                  }
                  Update: {
                    "actor_id"?: string,"command_id"?: string,"created_at"?: string,"decision"?: string,"dtr_id"?: string,"dtr_revision"?: number,"enrollment_id"?: string,"id"?: string,"reason"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "dtr_review_events_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "dtr_review_events_dtr_id_enrollment_id_fkey"
      columns: ["dtr_id","enrollment_id"]
isOneToOne: false
      referencedRelation: "dtr_versions"
      referencedColumns: ["id","enrollment_id"]
    },{
      foreignKeyName: "dtr_review_events_enrollment_id_fkey"
      columns: ["enrollment_id"]
isOneToOne: false
      referencedRelation: "enrollments"
      referencedColumns: ["id"]
    }
                  ]
                },"dtr_versions": {
                  Row: {
                    "ends_on": string,"enrollment_id": string,"generated_at": string,"id": string,"period_key": string,"printable_snapshot": NonNullable<Json>,"remarks": string,"reviewed_at": string | null,"reviewed_by": string | null,"revision": number,"starts_on": string,"status": string,"submitted_at": string | null,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "ends_on": string,"enrollment_id": string,"generated_at"?: string,"id"?: string,"period_key": string,"printable_snapshot": NonNullable<Json>,"remarks"?: string,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"revision"?: number,"starts_on": string,"status": string,"submitted_at"?: string | null,"version": number
                  }
                  Update: {
                    "ends_on"?: string,"enrollment_id"?: string,"generated_at"?: string,"id"?: string,"period_key"?: string,"printable_snapshot"?: NonNullable<Json>,"remarks"?: string,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"revision"?: number,"starts_on"?: string,"status"?: string,"submitted_at"?: string | null,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "dtr_versions_enrollment_id_fkey"
      columns: ["enrollment_id"]
isOneToOne: false
      referencedRelation: "enrollments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "dtr_versions_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"eligible_students": {
                  Row: {
                    "display_name": string,"email": string,"id": string,"import_batch_id": string,"imported_at": string,"imported_by": string,"invited_profile_id": string | null,"program_id": string,"section": string,"student_number": string
                  }
                  ComputedFields: never
                  Insert: {
                    "display_name": string,"email": string,"id"?: string,"import_batch_id": string,"imported_at"?: string,"imported_by": string,"invited_profile_id"?: string | null,"program_id": string,"section": string,"student_number": string
                  }
                  Update: {
                    "display_name"?: string,"email"?: string,"id"?: string,"import_batch_id"?: string,"imported_at"?: string,"imported_by"?: string,"invited_profile_id"?: string | null,"program_id"?: string,"section"?: string,"student_number"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "eligible_students_import_batch_id_fkey"
      columns: ["import_batch_id"]
isOneToOne: false
      referencedRelation: "import_batches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "eligible_students_imported_by_fkey"
      columns: ["imported_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "eligible_students_invited_profile_id_fkey"
      columns: ["invited_profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "eligible_students_program_id_fkey"
      columns: ["program_id"]
isOneToOne: false
      referencedRelation: "programs"
      referencedColumns: ["id"]
    }
                  ]
                },"enrollment_events": {
                  Row: {
                    "action": string,"actor_id": string,"after_revision": number,"basis_snapshot": NonNullable<Json>,"before_revision": number,"command_id": string,"created_at": string,"enrollment_id": string,"from_clearance": string,"from_outcome": string,"from_stage": string,"id": string,"reason": string,"to_clearance": string,"to_outcome": string,"to_stage": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id": string,"after_revision": number,"basis_snapshot": NonNullable<Json>,"before_revision": number,"command_id": string,"created_at"?: string,"enrollment_id": string,"from_clearance": string,"from_outcome": string,"from_stage": string,"id"?: string,"reason": string,"to_clearance": string,"to_outcome": string,"to_stage": string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string,"after_revision"?: number,"basis_snapshot"?: NonNullable<Json>,"before_revision"?: number,"command_id"?: string,"created_at"?: string,"enrollment_id"?: string,"from_clearance"?: string,"from_outcome"?: string,"from_stage"?: string,"id"?: string,"reason"?: string,"to_clearance"?: string,"to_outcome"?: string,"to_stage"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "enrollment_events_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "enrollment_events_enrollment_id_fkey"
      columns: ["enrollment_id"]
isOneToOne: false
      referencedRelation: "enrollments"
      referencedColumns: ["id"]
    }
                  ]
                },"enrollment_requirements": {
                  Row: {
                    "definition_id": string,"definition_snapshot": NonNullable<Json>,"due_at": string | null,"enrollment_id": string,"id": string,"instance_key": string,"revision": number,"waived_at": string | null,"waiver_actor": string | null,"waiver_reason": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "definition_id": string,"definition_snapshot": NonNullable<Json>,"due_at"?: string | null,"enrollment_id": string,"id"?: string,"instance_key"?: string,"revision"?: number,"waived_at"?: string | null,"waiver_actor"?: string | null,"waiver_reason"?: string | null
                  }
                  Update: {
                    "definition_id"?: string,"definition_snapshot"?: NonNullable<Json>,"due_at"?: string | null,"enrollment_id"?: string,"id"?: string,"instance_key"?: string,"revision"?: number,"waived_at"?: string | null,"waiver_actor"?: string | null,"waiver_reason"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "enrollment_requirements_definition_id_fkey"
      columns: ["definition_id"]
isOneToOne: false
      referencedRelation: "requirement_definitions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "enrollment_requirements_enrollment_id_fkey"
      columns: ["enrollment_id"]
isOneToOne: false
      referencedRelation: "enrollments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "enrollment_requirements_waiver_actor_fkey"
      columns: ["waiver_actor"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"enrollments": {
                  Row: {
                    "attempt": number,"completed_at": string | null,"component": number,"created_at": string,"id": string,"lifecycle": string,"outcome": string,"policy_version_id": string,"program_id": string,"required_minutes": number,"revision": number,"student_id": string,"term_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempt"?: number,"completed_at"?: string | null,"component": number,"created_at"?: string,"id"?: string,"lifecycle"?: string,"outcome"?: string,"policy_version_id": string,"program_id": string,"required_minutes": number,"revision"?: number,"student_id": string,"term_id": string
                  }
                  Update: {
                    "attempt"?: number,"completed_at"?: string | null,"component"?: number,"created_at"?: string,"id"?: string,"lifecycle"?: string,"outcome"?: string,"policy_version_id"?: string,"program_id"?: string,"required_minutes"?: number,"revision"?: number,"student_id"?: string,"term_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "enrollments_policy_version_id_fkey"
      columns: ["policy_version_id"]
isOneToOne: false
      referencedRelation: "policy_versions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "enrollments_policy_version_id_program_id_component_fkey"
      columns: ["policy_version_id","program_id","component"]
isOneToOne: false
      referencedRelation: "policy_versions"
      referencedColumns: ["id","program_id","component"]
    },{
      foreignKeyName: "enrollments_program_id_fkey"
      columns: ["program_id"]
isOneToOne: false
      referencedRelation: "programs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "enrollments_student_id_fkey"
      columns: ["student_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "enrollments_term_id_fkey"
      columns: ["term_id"]
isOneToOne: false
      referencedRelation: "academic_terms"
      referencedColumns: ["id"]
    }
                  ]
                },"evaluation_criteria": {
                  Row: {
                    "id": string,"label": string,"max_points": number,"ordinal": number,"template_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"label": string,"max_points": number,"ordinal": number,"template_id": string
                  }
                  Update: {
                    "id"?: string,"label"?: string,"max_points"?: number,"ordinal"?: number,"template_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "evaluation_criteria_template_id_fkey"
      columns: ["template_id"]
isOneToOne: false
      referencedRelation: "evaluation_templates"
      referencedColumns: ["id"]
    }
                  ]
                },"evaluation_scores": {
                  Row: {
                    "criterion_id": string,"evaluation_id": string,"max_points_snapshot": number,"points": number,"template_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "criterion_id": string,"evaluation_id": string,"max_points_snapshot": number,"points": number,"template_id": string
                  }
                  Update: {
                    "criterion_id"?: string,"evaluation_id"?: string,"max_points_snapshot"?: number,"points"?: number,"template_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "evaluation_scores_criterion_id_fkey"
      columns: ["criterion_id"]
isOneToOne: false
      referencedRelation: "evaluation_criteria"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "evaluation_scores_criterion_id_template_id_fkey"
      columns: ["criterion_id","template_id"]
isOneToOne: false
      referencedRelation: "evaluation_criteria"
      referencedColumns: ["id","template_id"]
    },{
      foreignKeyName: "evaluation_scores_evaluation_id_fkey"
      columns: ["evaluation_id"]
isOneToOne: false
      referencedRelation: "evaluation_versions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "evaluation_scores_evaluation_id_template_id_fkey"
      columns: ["evaluation_id","template_id"]
isOneToOne: false
      referencedRelation: "evaluation_versions"
      referencedColumns: ["id","template_id"]
    }
                  ]
                },"evaluation_templates": {
                  Row: {
                    "calculation_rule": NonNullable<Json>,"id": string,"kind": string,"policy_version_id": string,"published_at": string | null,"title": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "calculation_rule": NonNullable<Json>,"id"?: string,"kind": string,"policy_version_id": string,"published_at"?: string | null,"title": string,"version": number
                  }
                  Update: {
                    "calculation_rule"?: NonNullable<Json>,"id"?: string,"kind"?: string,"policy_version_id"?: string,"published_at"?: string | null,"title"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "evaluation_templates_policy_version_id_fkey"
      columns: ["policy_version_id"]
isOneToOne: false
      referencedRelation: "policy_versions"
      referencedColumns: ["id"]
    }
                  ]
                },"evaluation_versions": {
                  Row: {
                    "content_hash": string | null,"created_by": string,"document_id": string | null,"enrollment_id": string,"evaluated_on": string | null,"evaluator_affiliation": string,"evaluator_name": string,"evaluator_profile_id": string | null,"id": string,"is_current": boolean,"kind": string,"reviewed_at": string | null,"reviewed_by": string | null,"revision": number,"rubric_snapshot": NonNullable<Json>,"scores": NonNullable<Json>,"status": string,"submitted_at": string | null,"template_id": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "content_hash"?: string | null,"created_by": string,"document_id"?: string | null,"enrollment_id": string,"evaluated_on"?: string | null,"evaluator_affiliation": string,"evaluator_name": string,"evaluator_profile_id"?: string | null,"id"?: string,"is_current"?: boolean,"kind": string,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"revision"?: number,"rubric_snapshot": NonNullable<Json>,"scores": NonNullable<Json>,"status": string,"submitted_at"?: string | null,"template_id": string,"version": number
                  }
                  Update: {
                    "content_hash"?: string | null,"created_by"?: string,"document_id"?: string | null,"enrollment_id"?: string,"evaluated_on"?: string | null,"evaluator_affiliation"?: string,"evaluator_name"?: string,"evaluator_profile_id"?: string | null,"id"?: string,"is_current"?: boolean,"kind"?: string,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"revision"?: number,"rubric_snapshot"?: NonNullable<Json>,"scores"?: NonNullable<Json>,"status"?: string,"submitted_at"?: string | null,"template_id"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "evaluation_versions_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "evaluation_versions_document_id_enrollment_id_fkey"
      columns: ["document_id","enrollment_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id","enrollment_id"]
    },{
      foreignKeyName: "evaluation_versions_enrollment_id_fkey"
      columns: ["enrollment_id"]
isOneToOne: false
      referencedRelation: "enrollments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "evaluation_versions_evaluator_profile_id_fkey"
      columns: ["evaluator_profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "evaluation_versions_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "evaluation_versions_template_id_fkey"
      columns: ["template_id"]
isOneToOne: false
      referencedRelation: "evaluation_templates"
      referencedColumns: ["id"]
    }
                  ]
                },"hour_credits": {
                  Row: {
                    "credit_date": string,"credited_at": string,"dtr_id": string,"enrollment_id": string,"id": string,"invalidated_at": string | null,"invalidated_by": string | null,"invalidation_reason": string | null,"minutes": number,"session_id": string,"session_revision": number
                  }
                  ComputedFields: never
                  Insert: {
                    "credit_date": string,"credited_at"?: string,"dtr_id": string,"enrollment_id": string,"id"?: string,"invalidated_at"?: string | null,"invalidated_by"?: string | null,"invalidation_reason"?: string | null,"minutes": number,"session_id": string,"session_revision": number
                  }
                  Update: {
                    "credit_date"?: string,"credited_at"?: string,"dtr_id"?: string,"enrollment_id"?: string,"id"?: string,"invalidated_at"?: string | null,"invalidated_by"?: string | null,"invalidation_reason"?: string | null,"minutes"?: number,"session_id"?: string,"session_revision"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "hour_credits_dtr_id_enrollment_id_fkey"
      columns: ["dtr_id","enrollment_id"]
isOneToOne: false
      referencedRelation: "dtr_versions"
      referencedColumns: ["id","enrollment_id"]
    },{
      foreignKeyName: "hour_credits_dtr_id_session_id_enrollment_id_session_revis_fkey"
      columns: ["dtr_id","session_id","enrollment_id","session_revision"]
isOneToOne: false
      referencedRelation: "dtr_entries"
      referencedColumns: ["dtr_id","session_id","enrollment_id","session_revision"]
    },{
      foreignKeyName: "hour_credits_enrollment_id_fkey"
      columns: ["enrollment_id"]
isOneToOne: false
      referencedRelation: "enrollments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "hour_credits_invalidated_by_fkey"
      columns: ["invalidated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "hour_credits_session_id_enrollment_id_fkey"
      columns: ["session_id","enrollment_id"]
isOneToOne: false
      referencedRelation: "attendance_sessions"
      referencedColumns: ["id","enrollment_id"]
    }
                  ]
                },"identity_configuration": {
                  Row: {
                    "current_notice_version": string | null,"singleton": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "current_notice_version"?: string | null,"singleton"?: boolean
                  }
                  Update: {
                    "current_notice_version"?: string | null,"singleton"?: boolean
                  }
                  Relationships: [
                    
                  ]
                },"import_batches": {
                  Row: {
                    "content_hash": string,"created_at": string,"id": string,"imported_by": string,"imported_count": number,"row_count": number,"unchanged_count": number
                  }
                  ComputedFields: never
                  Insert: {
                    "content_hash": string,"created_at"?: string,"id"?: string,"imported_by": string,"imported_count": number,"row_count": number,"unchanged_count": number
                  }
                  Update: {
                    "content_hash"?: string,"created_at"?: string,"id"?: string,"imported_by"?: string,"imported_count"?: number,"row_count"?: number,"unchanged_count"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "import_batches_imported_by_fkey"
      columns: ["imported_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"import_previews": {
                  Row: {
                    "actor_id": string,"consumed_at": string | null,"content_hash": string,"created_at": string,"expires_at": string,"id": string,"normalized_rows": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id": string,"consumed_at"?: string | null,"content_hash": string,"created_at"?: string,"expires_at": string,"id"?: string,"normalized_rows": NonNullable<Json>
                  }
                  Update: {
                    "actor_id"?: string,"consumed_at"?: string | null,"content_hash"?: string,"created_at"?: string,"expires_at"?: string,"id"?: string,"normalized_rows"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "import_previews_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"journal_dtr_sources": {
                  Row: {
                    "dtr_id": string,"dtr_revision": number,"enrollment_id": string,"frozen_snapshot": NonNullable<Json>,"journal_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "dtr_id": string,"dtr_revision": number,"enrollment_id": string,"frozen_snapshot": NonNullable<Json>,"journal_id": string
                  }
                  Update: {
                    "dtr_id"?: string,"dtr_revision"?: number,"enrollment_id"?: string,"frozen_snapshot"?: NonNullable<Json>,"journal_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "journal_dtr_sources_dtr_id_enrollment_id_fkey"
      columns: ["dtr_id","enrollment_id"]
isOneToOne: false
      referencedRelation: "dtr_versions"
      referencedColumns: ["id","enrollment_id"]
    },{
      foreignKeyName: "journal_dtr_sources_enrollment_id_fkey"
      columns: ["enrollment_id"]
isOneToOne: false
      referencedRelation: "enrollments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "journal_dtr_sources_journal_id_enrollment_id_fkey"
      columns: ["journal_id","enrollment_id"]
isOneToOne: false
      referencedRelation: "journal_versions"
      referencedColumns: ["id","enrollment_id"]
    }
                  ]
                },"journal_tasks": {
                  Row: {
                    "enrollment_id": string,"journal_id": string,"task_version_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "enrollment_id": string,"journal_id": string,"task_version_id": string
                  }
                  Update: {
                    "enrollment_id"?: string,"journal_id"?: string,"task_version_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "journal_tasks_enrollment_id_fkey"
      columns: ["enrollment_id"]
isOneToOne: false
      referencedRelation: "enrollments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "journal_tasks_journal_id_enrollment_id_fkey"
      columns: ["journal_id","enrollment_id"]
isOneToOne: false
      referencedRelation: "journal_versions"
      referencedColumns: ["id","enrollment_id"]
    },{
      foreignKeyName: "journal_tasks_task_version_id_enrollment_id_fkey"
      columns: ["task_version_id","enrollment_id"]
isOneToOne: false
      referencedRelation: "task_versions"
      referencedColumns: ["id","enrollment_id"]
    }
                  ]
                },"journal_versions": {
                  Row: {
                    "content": NonNullable<Json>,"content_hash": string | null,"created_by": string,"ends_on": string,"enrollment_id": string,"id": string,"is_current": boolean,"period_key": string,"reviewed_at": string | null,"reviewed_by": string | null,"revision": number,"starts_on": string,"status": string,"submitted_at": string | null,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "content": NonNullable<Json>,"content_hash"?: string | null,"created_by": string,"ends_on": string,"enrollment_id": string,"id"?: string,"is_current"?: boolean,"period_key": string,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"revision"?: number,"starts_on": string,"status": string,"submitted_at"?: string | null,"version": number
                  }
                  Update: {
                    "content"?: NonNullable<Json>,"content_hash"?: string | null,"created_by"?: string,"ends_on"?: string,"enrollment_id"?: string,"id"?: string,"is_current"?: boolean,"period_key"?: string,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"revision"?: number,"starts_on"?: string,"status"?: string,"submitted_at"?: string | null,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "journal_versions_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "journal_versions_enrollment_id_fkey"
      columns: ["enrollment_id"]
isOneToOne: false
      referencedRelation: "enrollments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "journal_versions_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"login_email_checks": {
                  Row: {
                    "auth_user_id": string,"email_session_id": string | null,"expires_at": string,"session_id": string,"verified_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "auth_user_id": string,"email_session_id"?: string | null,"expires_at"?: string,"session_id": string,"verified_at"?: string
                  }
                  Update: {
                    "auth_user_id"?: string,"email_session_id"?: string | null,"expires_at"?: string,"session_id"?: string,"verified_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"memberships": {
                  Row: {
                    "active": boolean,"change_reason": string | null,"granted_at": string,"granted_by": string | null,"id": string,"profile_id": string,"program_id": string,"revision": number,"revoked_at": string | null,"revoked_by": string | null,"role": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"change_reason"?: string | null,"granted_at"?: string,"granted_by"?: string | null,"id"?: string,"profile_id": string,"program_id": string,"revision"?: number,"revoked_at"?: string | null,"revoked_by"?: string | null,"role": string
                  }
                  Update: {
                    "active"?: boolean,"change_reason"?: string | null,"granted_at"?: string,"granted_by"?: string | null,"id"?: string,"profile_id"?: string,"program_id"?: string,"revision"?: number,"revoked_at"?: string | null,"revoked_by"?: string | null,"role"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "memberships_granted_by_fkey"
      columns: ["granted_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "memberships_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "memberships_program_id_fkey"
      columns: ["program_id"]
isOneToOne: false
      referencedRelation: "programs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "memberships_revoked_by_fkey"
      columns: ["revoked_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"messages": {
                  Row: {
                    "body": string,"created_at": string,"enrollment_id": string,"id": string,"read_at": string | null,"recipient_id": string,"sender_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"created_at"?: string,"enrollment_id": string,"id"?: string,"read_at"?: string | null,"recipient_id": string,"sender_id": string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"enrollment_id"?: string,"id"?: string,"read_at"?: string | null,"recipient_id"?: string,"sender_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "messages_enrollment_id_fkey"
      columns: ["enrollment_id"]
isOneToOne: false
      referencedRelation: "enrollments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_recipient_id_fkey"
      columns: ["recipient_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_sender_id_fkey"
      columns: ["sender_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"moa_routing_events": {
                  Row: {
                    "actor_id": string,"command_id": string,"created_at": string,"enrollment_id": string,"enrollment_revision": number,"evidence_note": string | null,"id": string,"remarks": string,"status": string,"submission_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id": string,"command_id": string,"created_at"?: string,"enrollment_id": string,"enrollment_revision": number,"evidence_note"?: string | null,"id"?: string,"remarks": string,"status": string,"submission_id"?: string | null
                  }
                  Update: {
                    "actor_id"?: string,"command_id"?: string,"created_at"?: string,"enrollment_id"?: string,"enrollment_revision"?: number,"evidence_note"?: string | null,"id"?: string,"remarks"?: string,"status"?: string,"submission_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "moa_routing_events_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "moa_routing_events_enrollment_id_fkey"
      columns: ["enrollment_id"]
isOneToOne: false
      referencedRelation: "enrollments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "moa_routing_events_submission_id_enrollment_id_fkey"
      columns: ["submission_id","enrollment_id"]
isOneToOne: false
      referencedRelation: "submission_versions"
      referencedColumns: ["id","enrollment_id"]
    }
                  ]
                },"notification_outbox": {
                  Row: {
                    "attempts": number,"channel": string,"delivered_at": string | null,"id": string,"last_error_code": string | null,"next_attempt_at": string,"notification_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"channel": string,"delivered_at"?: string | null,"id"?: string,"last_error_code"?: string | null,"next_attempt_at"?: string,"notification_id": string
                  }
                  Update: {
                    "attempts"?: number,"channel"?: string,"delivered_at"?: string | null,"id"?: string,"last_error_code"?: string | null,"next_attempt_at"?: string,"notification_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notification_outbox_notification_id_fkey"
      columns: ["notification_id"]
isOneToOne: false
      referencedRelation: "notifications"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "content": NonNullable<Json>,"created_at": string,"enrollment_id": string | null,"event_key": string,"id": string,"read_at": string | null,"recipient_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "content": NonNullable<Json>,"created_at"?: string,"enrollment_id"?: string | null,"event_key": string,"id"?: string,"read_at"?: string | null,"recipient_id": string
                  }
                  Update: {
                    "content"?: NonNullable<Json>,"created_at"?: string,"enrollment_id"?: string | null,"event_key"?: string,"id"?: string,"read_at"?: string | null,"recipient_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_enrollment_id_fkey"
      columns: ["enrollment_id"]
isOneToOne: false
      referencedRelation: "enrollments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_recipient_id_fkey"
      columns: ["recipient_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"placements": {
                  Row: {
                    "active": boolean,"company_id": string,"ends_on": string | null,"enrollment_id": string,"id": string,"latitude": number | null,"longitude": number | null,"radius_meters": number | null,"revision": number,"schedule_snapshot": NonNullable<Json>,"starts_on": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"company_id": string,"ends_on"?: string | null,"enrollment_id": string,"id"?: string,"latitude"?: number | null,"longitude"?: number | null,"radius_meters"?: number | null,"revision"?: number,"schedule_snapshot": NonNullable<Json>,"starts_on": string
                  }
                  Update: {
                    "active"?: boolean,"company_id"?: string,"ends_on"?: string | null,"enrollment_id"?: string,"id"?: string,"latitude"?: number | null,"longitude"?: number | null,"radius_meters"?: number | null,"revision"?: number,"schedule_snapshot"?: NonNullable<Json>,"starts_on"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "placements_company_id_fkey"
      columns: ["company_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "placements_enrollment_id_fkey"
      columns: ["enrollment_id"]
isOneToOne: false
      referencedRelation: "enrollments"
      referencedColumns: ["id"]
    }
                  ]
                },"policy_versions": {
                  Row: {
                    "attendance_policy": NonNullable<Json>,"component": number,"confirmed_at": string | null,"confirmed_by": string | null,"id": string,"program_id": string,"required_minutes": number,"semester": string | null,"timezone": string,"version": number,"year_level": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "attendance_policy"?: NonNullable<Json>,"component": number,"confirmed_at"?: string | null,"confirmed_by"?: string | null,"id"?: string,"program_id": string,"required_minutes": number,"semester"?: string | null,"timezone"?: string,"version": number,"year_level"?: number | null
                  }
                  Update: {
                    "attendance_policy"?: NonNullable<Json>,"component"?: number,"confirmed_at"?: string | null,"confirmed_by"?: string | null,"id"?: string,"program_id"?: string,"required_minutes"?: number,"semester"?: string | null,"timezone"?: string,"version"?: number,"year_level"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "policy_versions_confirmed_by_fkey"
      columns: ["confirmed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "policy_versions_program_id_fkey"
      columns: ["program_id"]
isOneToOne: false
      referencedRelation: "programs"
      referencedColumns: ["id"]
    }
                  ]
                },"portfolio_content_catalog": {
                  Row: {
                    "id": string,"ordinal": number,"source_note": string,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id": string,"ordinal": number,"source_note": string,"title": string
                  }
                  Update: {
                    "id"?: string,"ordinal"?: number,"source_note"?: string,"title"?: string
                  }
                  Relationships: [
                    
                  ]
                },"portfolio_sources": {
                  Row: {
                    "document_id": string | null,"dtr_id": string | null,"enrollment_id": string,"evaluation_id": string | null,"id": string,"journal_id": string | null,"portfolio_id": string,"requirement_id": string | null,"source_hash": string,"source_revision": number,"submission_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "document_id"?: string | null,"dtr_id"?: string | null,"enrollment_id": string,"evaluation_id"?: string | null,"id"?: string,"journal_id"?: string | null,"portfolio_id": string,"requirement_id"?: string | null,"source_hash": string,"source_revision": number,"submission_id"?: string | null
                  }
                  Update: {
                    "document_id"?: string | null,"dtr_id"?: string | null,"enrollment_id"?: string,"evaluation_id"?: string | null,"id"?: string,"journal_id"?: string | null,"portfolio_id"?: string,"requirement_id"?: string | null,"source_hash"?: string,"source_revision"?: number,"submission_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "portfolio_sources_document_id_enrollment_id_fkey"
      columns: ["document_id","enrollment_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id","enrollment_id"]
    },{
      foreignKeyName: "portfolio_sources_dtr_id_enrollment_id_fkey"
      columns: ["dtr_id","enrollment_id"]
isOneToOne: false
      referencedRelation: "dtr_versions"
      referencedColumns: ["id","enrollment_id"]
    },{
      foreignKeyName: "portfolio_sources_enrollment_id_fkey"
      columns: ["enrollment_id"]
isOneToOne: false
      referencedRelation: "enrollments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "portfolio_sources_evaluation_id_enrollment_id_fkey"
      columns: ["evaluation_id","enrollment_id"]
isOneToOne: false
      referencedRelation: "evaluation_versions"
      referencedColumns: ["id","enrollment_id"]
    },{
      foreignKeyName: "portfolio_sources_journal_id_enrollment_id_fkey"
      columns: ["journal_id","enrollment_id"]
isOneToOne: false
      referencedRelation: "journal_versions"
      referencedColumns: ["id","enrollment_id"]
    },{
      foreignKeyName: "portfolio_sources_portfolio_id_enrollment_id_fkey"
      columns: ["portfolio_id","enrollment_id"]
isOneToOne: false
      referencedRelation: "portfolio_versions"
      referencedColumns: ["id","enrollment_id"]
    },{
      foreignKeyName: "portfolio_sources_requirement_id_enrollment_id_fkey"
      columns: ["requirement_id","enrollment_id"]
isOneToOne: false
      referencedRelation: "enrollment_requirements"
      referencedColumns: ["id","enrollment_id"]
    },{
      foreignKeyName: "portfolio_sources_submission_id_enrollment_id_fkey"
      columns: ["submission_id","enrollment_id"]
isOneToOne: false
      referencedRelation: "submission_versions"
      referencedColumns: ["id","enrollment_id"]
    }
                  ]
                },"portfolio_versions": {
                  Row: {
                    "adviser_approved_at": string | null,"adviser_reviewed_by": string | null,"coordinator_approved_at": string | null,"coordinator_reviewed_by": string | null,"created_by": string,"enrollment_id": string,"id": string,"is_current": boolean,"manifest": NonNullable<Json>,"manifest_hash": string | null,"revision": number,"status": string,"submitted_at": string | null,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "adviser_approved_at"?: string | null,"adviser_reviewed_by"?: string | null,"coordinator_approved_at"?: string | null,"coordinator_reviewed_by"?: string | null,"created_by": string,"enrollment_id": string,"id"?: string,"is_current"?: boolean,"manifest": NonNullable<Json>,"manifest_hash"?: string | null,"revision"?: number,"status": string,"submitted_at"?: string | null,"version": number
                  }
                  Update: {
                    "adviser_approved_at"?: string | null,"adviser_reviewed_by"?: string | null,"coordinator_approved_at"?: string | null,"coordinator_reviewed_by"?: string | null,"created_by"?: string,"enrollment_id"?: string,"id"?: string,"is_current"?: boolean,"manifest"?: NonNullable<Json>,"manifest_hash"?: string | null,"revision"?: number,"status"?: string,"submitted_at"?: string | null,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "portfolio_versions_adviser_reviewed_by_fkey"
      columns: ["adviser_reviewed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "portfolio_versions_coordinator_reviewed_by_fkey"
      columns: ["coordinator_reviewed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "portfolio_versions_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "portfolio_versions_enrollment_id_fkey"
      columns: ["enrollment_id"]
isOneToOne: false
      referencedRelation: "enrollments"
      referencedColumns: ["id"]
    }
                  ]
                },"practicum_class_members": {
                  Row: {
                    "class_id": string,"created_at": string,"created_by": string,"enrollment_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "class_id": string,"created_at"?: string,"created_by": string,"enrollment_id": string
                  }
                  Update: {
                    "class_id"?: string,"created_at"?: string,"created_by"?: string,"enrollment_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "practicum_class_members_class_id_fkey"
      columns: ["class_id"]
isOneToOne: false
      referencedRelation: "practicum_classes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "practicum_class_members_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "practicum_class_members_enrollment_id_fkey"
      columns: ["enrollment_id"]
isOneToOne: true
      referencedRelation: "enrollments"
      referencedColumns: ["id"]
    }
                  ]
                },"practicum_classes": {
                  Row: {
                    "adviser_id": string | null,"created_at": string,"created_by": string,"id": string,"join_code": string | null,"join_code_enabled": boolean,"policy_id": string,"program_id": string,"revision": number,"section": string,"term_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "adviser_id"?: string | null,"created_at"?: string,"created_by": string,"id"?: string,"join_code"?: string | null,"join_code_enabled"?: boolean,"policy_id": string,"program_id": string,"revision"?: number,"section": string,"term_id": string
                  }
                  Update: {
                    "adviser_id"?: string | null,"created_at"?: string,"created_by"?: string,"id"?: string,"join_code"?: string | null,"join_code_enabled"?: boolean,"policy_id"?: string,"program_id"?: string,"revision"?: number,"section"?: string,"term_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "practicum_classes_adviser_id_fkey"
      columns: ["adviser_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "practicum_classes_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "practicum_classes_policy_id_fkey"
      columns: ["policy_id"]
isOneToOne: false
      referencedRelation: "policy_versions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "practicum_classes_program_id_fkey"
      columns: ["program_id"]
isOneToOne: false
      referencedRelation: "programs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "practicum_classes_term_id_fkey"
      columns: ["term_id"]
isOneToOne: false
      referencedRelation: "academic_terms"
      referencedColumns: ["id"]
    }
                  ]
                },"privacy_acknowledgments": {
                  Row: {
                    "acknowledged_at": string,"id": string,"notice_version": string,"profile_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "acknowledged_at"?: string,"id"?: string,"notice_version": string,"profile_id": string
                  }
                  Update: {
                    "acknowledged_at"?: string,"id"?: string,"notice_version"?: string,"profile_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "privacy_acknowledgments_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "activated_at": string | null,"auth_user_id": string | null,"created_at": string,"display_name": string,"id": string,"revision": number,"status": string,"student_number": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activated_at"?: string | null,"auth_user_id"?: string | null,"created_at"?: string,"display_name": string,"id"?: string,"revision"?: number,"status"?: string,"student_number"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "activated_at"?: string | null,"auth_user_id"?: string | null,"created_at"?: string,"display_name"?: string,"id"?: string,"revision"?: number,"status"?: string,"student_number"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"program_checklist_history": {
                  Row: {
                    "attendance_policy": NonNullable<Json>,"created_at": string,"program_id": string,"requirements": NonNullable<Json>,"revision": number,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "attendance_policy": NonNullable<Json>,"created_at"?: string,"program_id": string,"requirements": NonNullable<Json>,"revision": number,"updated_by"?: string | null
                  }
                  Update: {
                    "attendance_policy"?: NonNullable<Json>,"created_at"?: string,"program_id"?: string,"requirements"?: NonNullable<Json>,"revision"?: number,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "program_checklist_history_program_id_fkey"
      columns: ["program_id"]
isOneToOne: false
      referencedRelation: "programs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "program_checklist_history_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"program_checklists": {
                  Row: {
                    "attendance_policy": NonNullable<Json>,"program_id": string,"requirements": NonNullable<Json>,"revision": number,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "attendance_policy"?: NonNullable<Json>,"program_id": string,"requirements": NonNullable<Json>,"revision"?: number,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "attendance_policy"?: NonNullable<Json>,"program_id"?: string,"requirements"?: NonNullable<Json>,"revision"?: number,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "program_checklists_program_id_fkey"
      columns: ["program_id"]
isOneToOne: true
      referencedRelation: "programs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "program_checklists_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"program_configuration": {
                  Row: {
                    "approval_reference": string,"program_id": string,"staff_email_domains": (string)[],"student_email_domains": (string)[],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "approval_reference": string,"program_id": string,"staff_email_domains"?: (string)[],"student_email_domains"?: (string)[],"updated_at"?: string
                  }
                  Update: {
                    "approval_reference"?: string,"program_id"?: string,"staff_email_domains"?: (string)[],"student_email_domains"?: (string)[],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "program_configuration_program_id_fkey"
      columns: ["program_id"]
isOneToOne: true
      referencedRelation: "programs"
      referencedColumns: ["id"]
    }
                  ]
                },"programs": {
                  Row: {
                    "code": string,"id": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"id"?: string,"name": string
                  }
                  Update: {
                    "code"?: string,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"reconstruction_requests": {
                  Row: {
                    "created_session_id": string | null,"decided_at": string | null,"decided_by": string | null,"decision_reason": string | null,"enrollment_id": string,"evidence_document_id": string,"id": string,"placement_id": string,"proposed_clock_in": string,"proposed_clock_out": string,"reason": string,"requested_at": string,"requested_by": string,"revision": number,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_session_id"?: string | null,"decided_at"?: string | null,"decided_by"?: string | null,"decision_reason"?: string | null,"enrollment_id": string,"evidence_document_id": string,"id"?: string,"placement_id": string,"proposed_clock_in": string,"proposed_clock_out": string,"reason": string,"requested_at"?: string,"requested_by": string,"revision"?: number,"status": string
                  }
                  Update: {
                    "created_session_id"?: string | null,"decided_at"?: string | null,"decided_by"?: string | null,"decision_reason"?: string | null,"enrollment_id"?: string,"evidence_document_id"?: string,"id"?: string,"placement_id"?: string,"proposed_clock_in"?: string,"proposed_clock_out"?: string,"reason"?: string,"requested_at"?: string,"requested_by"?: string,"revision"?: number,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reconstruction_requests_created_session_id_enrollment_id_fkey"
      columns: ["created_session_id","enrollment_id"]
isOneToOne: false
      referencedRelation: "attendance_sessions"
      referencedColumns: ["id","enrollment_id"]
    },{
      foreignKeyName: "reconstruction_requests_decided_by_fkey"
      columns: ["decided_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reconstruction_requests_enrollment_id_fkey"
      columns: ["enrollment_id"]
isOneToOne: false
      referencedRelation: "enrollments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reconstruction_requests_evidence_document_id_enrollment_id_fkey"
      columns: ["evidence_document_id","enrollment_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id","enrollment_id"]
    },{
      foreignKeyName: "reconstruction_requests_placement_id_enrollment_id_fkey"
      columns: ["placement_id","enrollment_id"]
isOneToOne: false
      referencedRelation: "placements"
      referencedColumns: ["id","enrollment_id"]
    },{
      foreignKeyName: "reconstruction_requests_requested_by_fkey"
      columns: ["requested_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"requirement_definitions": {
                  Row: {
                    "allowed_submission_stages": (string)[],"code": string,"description": string,"evidence_type": string,"id": string,"mandatory": boolean,"policy_version_id": string,"recurrence": NonNullable<Json>,"reviewer": string,"stage": string,"template_version_id": string | null,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "allowed_submission_stages"?: (string)[],"code": string,"description"?: string,"evidence_type": string,"id"?: string,"mandatory"?: boolean,"policy_version_id": string,"recurrence"?: NonNullable<Json>,"reviewer": string,"stage": string,"template_version_id"?: string | null,"title": string
                  }
                  Update: {
                    "allowed_submission_stages"?: (string)[],"code"?: string,"description"?: string,"evidence_type"?: string,"id"?: string,"mandatory"?: boolean,"policy_version_id"?: string,"recurrence"?: NonNullable<Json>,"reviewer"?: string,"stage"?: string,"template_version_id"?: string | null,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "requirement_definitions_policy_version_id_fkey"
      columns: ["policy_version_id"]
isOneToOne: false
      referencedRelation: "policy_versions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "requirement_definitions_template_version_id_fkey"
      columns: ["template_version_id"]
isOneToOne: false
      referencedRelation: "template_versions"
      referencedColumns: ["id"]
    }
                  ]
                },"requirement_uploads": {
                  Row: {
                    "cleaned_at": string | null,"document_id": string,"enrollment_revision": number,"expires_at": string,"submission_revision": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cleaned_at"?: string | null,"document_id": string,"enrollment_revision": number,"expires_at"?: string,"submission_revision"?: number | null
                  }
                  Update: {
                    "cleaned_at"?: string | null,"document_id"?: string,"enrollment_revision"?: number,"expires_at"?: string,"submission_revision"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "requirement_uploads_document_id_fkey"
      columns: ["document_id"]
isOneToOne: true
      referencedRelation: "documents"
      referencedColumns: ["id"]
    }
                  ]
                },"review_events": {
                  Row: {
                    "command_id": string,"created_at": string,"decision": string,"enrollment_id": string,"id": string,"remarks": string,"reviewer_id": string,"reviewer_role": string,"submission_id": string,"submission_revision": number
                  }
                  ComputedFields: never
                  Insert: {
                    "command_id": string,"created_at"?: string,"decision": string,"enrollment_id": string,"id"?: string,"remarks"?: string,"reviewer_id": string,"reviewer_role": string,"submission_id": string,"submission_revision": number
                  }
                  Update: {
                    "command_id"?: string,"created_at"?: string,"decision"?: string,"enrollment_id"?: string,"id"?: string,"remarks"?: string,"reviewer_id"?: string,"reviewer_role"?: string,"submission_id"?: string,"submission_revision"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "review_events_enrollment_id_fkey"
      columns: ["enrollment_id"]
isOneToOne: false
      referencedRelation: "enrollments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "review_events_reviewer_id_fkey"
      columns: ["reviewer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "review_events_submission_id_enrollment_id_fkey"
      columns: ["submission_id","enrollment_id"]
isOneToOne: false
      referencedRelation: "submission_versions"
      referencedColumns: ["id","enrollment_id"]
    }
                  ]
                },"specialized_requirement_bindings": {
                  Row: {
                    "bound_by": string,"created_at": string,"dtr_id": string | null,"enrollment_id": string,"enrollment_revision": number,"evaluation_id": string | null,"id": string,"journal_id": string | null,"portfolio_id": string | null,"requirement_id": string,"source_revision": number
                  }
                  ComputedFields: never
                  Insert: {
                    "bound_by": string,"created_at"?: string,"dtr_id"?: string | null,"enrollment_id": string,"enrollment_revision": number,"evaluation_id"?: string | null,"id"?: string,"journal_id"?: string | null,"portfolio_id"?: string | null,"requirement_id": string,"source_revision": number
                  }
                  Update: {
                    "bound_by"?: string,"created_at"?: string,"dtr_id"?: string | null,"enrollment_id"?: string,"enrollment_revision"?: number,"evaluation_id"?: string | null,"id"?: string,"journal_id"?: string | null,"portfolio_id"?: string | null,"requirement_id"?: string,"source_revision"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "specialized_requirement_bindi_requirement_id_enrollment_id_fkey"
      columns: ["requirement_id","enrollment_id"]
isOneToOne: false
      referencedRelation: "enrollment_requirements"
      referencedColumns: ["id","enrollment_id"]
    },{
      foreignKeyName: "specialized_requirement_bindin_evaluation_id_enrollment_id_fkey"
      columns: ["evaluation_id","enrollment_id"]
isOneToOne: false
      referencedRelation: "evaluation_versions"
      referencedColumns: ["id","enrollment_id"]
    },{
      foreignKeyName: "specialized_requirement_binding_portfolio_id_enrollment_id_fkey"
      columns: ["portfolio_id","enrollment_id"]
isOneToOne: false
      referencedRelation: "portfolio_versions"
      referencedColumns: ["id","enrollment_id"]
    },{
      foreignKeyName: "specialized_requirement_bindings_bound_by_fkey"
      columns: ["bound_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "specialized_requirement_bindings_dtr_id_enrollment_id_fkey"
      columns: ["dtr_id","enrollment_id"]
isOneToOne: false
      referencedRelation: "dtr_versions"
      referencedColumns: ["id","enrollment_id"]
    },{
      foreignKeyName: "specialized_requirement_bindings_enrollment_id_fkey"
      columns: ["enrollment_id"]
isOneToOne: false
      referencedRelation: "enrollments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "specialized_requirement_bindings_journal_id_enrollment_id_fkey"
      columns: ["journal_id","enrollment_id"]
isOneToOne: false
      referencedRelation: "journal_versions"
      referencedColumns: ["id","enrollment_id"]
    }
                  ]
                },"staff_verification_events": {
                  Row: {
                    "command_id": string,"enrollment_id": string,"id": string,"note": string,"submission_id": string,"submission_revision": number,"verified_at": string,"verified_by": string
                  }
                  ComputedFields: never
                  Insert: {
                    "command_id": string,"enrollment_id": string,"id"?: string,"note": string,"submission_id": string,"submission_revision": number,"verified_at"?: string,"verified_by": string
                  }
                  Update: {
                    "command_id"?: string,"enrollment_id"?: string,"id"?: string,"note"?: string,"submission_id"?: string,"submission_revision"?: number,"verified_at"?: string,"verified_by"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "staff_verification_events_enrollment_id_fkey"
      columns: ["enrollment_id"]
isOneToOne: false
      referencedRelation: "enrollments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "staff_verification_events_submission_id_enrollment_id_fkey"
      columns: ["submission_id","enrollment_id"]
isOneToOne: false
      referencedRelation: "submission_versions"
      referencedColumns: ["id","enrollment_id"]
    },{
      foreignKeyName: "staff_verification_events_verified_by_fkey"
      columns: ["verified_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"submission_versions": {
                  Row: {
                    "artifact_ref": Json | null,"document_id": string | null,"enrollment_id": string,"evidence_note": string | null,"id": string,"is_current": boolean,"requirement_id": string,"review_started_at": string | null,"revision": number,"status": string,"submitted_at": string | null,"submitted_by": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "artifact_ref"?: Json | null,"document_id"?: string | null,"enrollment_id": string,"evidence_note"?: string | null,"id"?: string,"is_current"?: boolean,"requirement_id": string,"review_started_at"?: string | null,"revision"?: number,"status": string,"submitted_at"?: string | null,"submitted_by": string,"version": number
                  }
                  Update: {
                    "artifact_ref"?: Json | null,"document_id"?: string | null,"enrollment_id"?: string,"evidence_note"?: string | null,"id"?: string,"is_current"?: boolean,"requirement_id"?: string,"review_started_at"?: string | null,"revision"?: number,"status"?: string,"submitted_at"?: string | null,"submitted_by"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "submission_versions_document_id_enrollment_id_fkey"
      columns: ["document_id","enrollment_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id","enrollment_id"]
    },{
      foreignKeyName: "submission_versions_document_id_requirement_id_enrollment__fkey"
      columns: ["document_id","requirement_id","enrollment_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id","requirement_id","enrollment_id"]
    },{
      foreignKeyName: "submission_versions_enrollment_id_fkey"
      columns: ["enrollment_id"]
isOneToOne: false
      referencedRelation: "enrollments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "submission_versions_requirement_id_enrollment_id_fkey"
      columns: ["requirement_id","enrollment_id"]
isOneToOne: false
      referencedRelation: "enrollment_requirements"
      referencedColumns: ["id","enrollment_id"]
    },{
      foreignKeyName: "submission_versions_submitted_by_fkey"
      columns: ["submitted_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"task_versions": {
                  Row: {
                    "content": NonNullable<Json>,"content_hash": string | null,"created_at": string,"created_by": string,"enrollment_id": string,"id": string,"is_current": boolean,"revision": number,"status": string,"submitted_at": string | null,"task_date": string,"task_key": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "content": NonNullable<Json>,"content_hash"?: string | null,"created_at"?: string,"created_by": string,"enrollment_id": string,"id"?: string,"is_current"?: boolean,"revision"?: number,"status": string,"submitted_at"?: string | null,"task_date": string,"task_key": string,"version": number
                  }
                  Update: {
                    "content"?: NonNullable<Json>,"content_hash"?: string | null,"created_at"?: string,"created_by"?: string,"enrollment_id"?: string,"id"?: string,"is_current"?: boolean,"revision"?: number,"status"?: string,"submitted_at"?: string | null,"task_date"?: string,"task_key"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "task_versions_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_versions_enrollment_id_fkey"
      columns: ["enrollment_id"]
isOneToOne: false
      referencedRelation: "enrollments"
      referencedColumns: ["id"]
    }
                  ]
                },"template_links": {
                  Row: {
                    "category": string,"description": string,"id": string,"link_url": string,"name": string,"program_id": string,"revision": number,"source_key": string | null,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category": string,"description"?: string,"id"?: string,"link_url": string,"name": string,"program_id": string,"revision"?: number,"source_key"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "category"?: string,"description"?: string,"id"?: string,"link_url"?: string,"name"?: string,"program_id"?: string,"revision"?: number,"source_key"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "template_links_program_id_fkey"
      columns: ["program_id"]
isOneToOne: false
      referencedRelation: "programs"
      referencedColumns: ["id"]
    }
                  ]
                },"template_uploads": {
                  Row: {
                    "byte_count": number,"cleaned_at": string | null,"code": string,"expires_at": string,"id": string,"measured_hash": string | null,"object_path": string,"original_name": string,"program_id": string,"reserved_by": string,"stage": string,"state": string,"template_id": string | null,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "byte_count": number,"cleaned_at"?: string | null,"code": string,"expires_at"?: string,"id"?: string,"measured_hash"?: string | null,"object_path": string,"original_name": string,"program_id": string,"reserved_by": string,"stage": string,"state"?: string,"template_id"?: string | null,"title": string
                  }
                  Update: {
                    "byte_count"?: number,"cleaned_at"?: string | null,"code"?: string,"expires_at"?: string,"id"?: string,"measured_hash"?: string | null,"object_path"?: string,"original_name"?: string,"program_id"?: string,"reserved_by"?: string,"stage"?: string,"state"?: string,"template_id"?: string | null,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "template_uploads_program_id_fkey"
      columns: ["program_id"]
isOneToOne: false
      referencedRelation: "programs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "template_uploads_reserved_by_fkey"
      columns: ["reserved_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "template_uploads_template_id_fkey"
      columns: ["template_id"]
isOneToOne: false
      referencedRelation: "template_versions"
      referencedColumns: ["id"]
    }
                  ]
                },"template_versions": {
                  Row: {
                    "approved_external_url": string | null,"byte_count": number,"code": string,"id": string,"mime_type": string,"object_path": string,"program_id": string,"published_at": string | null,"published_by": string | null,"sha256": string,"stage": string,"status": string,"template_key": string,"title": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "approved_external_url"?: string | null,"byte_count": number,"code": string,"id"?: string,"mime_type": string,"object_path": string,"program_id": string,"published_at"?: string | null,"published_by"?: string | null,"sha256": string,"stage": string,"status": string,"template_key": string,"title": string,"version": number
                  }
                  Update: {
                    "approved_external_url"?: string | null,"byte_count"?: number,"code"?: string,"id"?: string,"mime_type"?: string,"object_path"?: string,"program_id"?: string,"published_at"?: string | null,"published_by"?: string | null,"sha256"?: string,"stage"?: string,"status"?: string,"template_key"?: string,"title"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "template_versions_program_id_fkey"
      columns: ["program_id"]
isOneToOne: false
      referencedRelation: "programs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "template_versions_published_by_fkey"
      columns: ["published_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"whitelist_login_setup": {
                  Row: {
                    "created_at": string,"decided_at": string | null,"invitation_id": string,"password_changed_at": string | null,"profile_id": string,"requires_password_change": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"decided_at"?: string | null,"invitation_id": string,"password_changed_at"?: string | null,"profile_id": string,"requires_password_change"?: boolean
                  }
                  Update: {
                    "created_at"?: string,"decided_at"?: string | null,"invitation_id"?: string,"password_changed_at"?: string | null,"profile_id"?: string,"requires_password_change"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "whitelist_login_setup_invitation_id_fkey"
      columns: ["invitation_id"]
isOneToOne: true
      referencedRelation: "account_invitations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "whitelist_login_setup_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "authorized_actor":
{ Args: { "actor_role": string,"target_program"?: string }; Returns: string
                           },
"begin_command":
{ Args: { "action": string,"actor": string,"command_id": string,"payload": Json }; Returns: Json
                           },
"current_clearance":
{ Args: { "target": string }; Returns: string
                           },
"enrollment_actor":
{ Args: { "actor_role": string,"target": string }; Returns: string
                           },
"finish_command":
{ Args: { "action": string,"actor": string,"after_revision"?: number,"before_revision"?: number,"command_id": string,"enrollment_id"?: string,"entity_id": string,"entity_type": string,"payload": Json,"result": Json }; Returns: Json
                           },
"gps_valid":
{ Args: { "gps": Json,"placement": Omit<Database["intrack"]['Tables']["placements"]['Row'], Database["intrack"]['Tables']["placements"]['ComputedFields']>,"received": string,"settings": Json }; Returns: boolean
                           },
"has_enrollment_scope":
{ Args: { "actor": string,"actor_role": string,"target": string }; Returns: boolean
                           },
"historical_training_allowed":
{ Args: { "ends_at": string,"placement": string,"starts_at": string,"target": string }; Returns: boolean
                           },
"identity_before_whitelist":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"identity_with_whitelist":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"intrack_enroll_practicum_class":
{ Args: { "actor_role": string,"command_id": string,"payload": Json }; Returns: Json
                           },
"invalidate_attendance":
{ Args: { "actor": string,"command": string,"reason": string,"target": string }; Returns: undefined
                           },
"json_hash":
{ Args: { "value": Json }; Returns: string
                           },
"portfolio_gate":
{ Args: { "target": string }; Returns: boolean
                           },
"portfolio_sources_current":
{ Args: { "target": string }; Returns: boolean
                           },
"requirement_actor":
{ Args: { "actor_role": string,"target": string }; Returns: string
                           },
"requirement_gate":
{ Args: { "accepted_moa"?: string,"stage": string,"target": string }; Returns: Json
                           },
"schedule_allows":
{ Args: { "instant": string,"schedule": Json }; Returns: boolean
                           },
"session_day_minutes":
{ Args: { "day": string,"s": Omit<Database["intrack"]['Tables']["attendance_sessions"]['Row'], Database["intrack"]['Tables']["attendance_sessions"]['ComputedFields']> }; Returns: number
                           },
"specialized_requirement_ready":
{ Args: { "target": string }; Returns: boolean
                           },
"validate_masterlist":
{ Args: { "actor": string,"rows": Json }; Returns: Json
                           },
"validate_program_checklist":
{ Args: { "items": Json }; Returns: undefined
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "intrack_academic_command":
{ Args: { "command_id": string,"payload": Json }; Returns: Json
                           },
"intrack_account_invitation_context":
{ Args: { "invitation_id": string }; Returns: Json
                           },
"intrack_ack_template_cleanup":
{ Args: { "upload_id": string }; Returns: undefined
                           },
"intrack_acknowledge_notice":
{ Args: { "notice_version": string }; Returns: undefined
                           },
"intrack_activate_account":
{ Args: { "notice_version": string,"subject": string }; Returns: Json
                           },
"intrack_administration_directory":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"intrack_artifact_file_command":
{ Args: { "action": string,"command_id": string,"payload": Json }; Returns: Json
                           },
"intrack_asset_recovery_inventory":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"intrack_assign_adviser":
{ Args: { "adviser_id": string,"command_id": string,"enrollment_id": string,"expected_revision": number,"reason": string }; Returns: Json
                           },
"intrack_attendance_command":
{ Args: { "action": string,"command_id": string,"payload": Json }; Returns: Json
                           },
"intrack_attendance_correction":
{ Args: { "command_id": string,"payload": Json }; Returns: Json
                           },
"intrack_attendance_exception":
{ Args: { "command_id": string,"payload": Json }; Returns: Json
                           },
"intrack_attest_requirement_file":
{ Args: { "content_hash": string,"document_id": string,"measured_bytes": number,"measured_mime": string }; Returns: undefined
                           },
"intrack_attest_template":
{ Args: { "content_hash": string,"measured_bytes": number,"measured_mime": string,"upload_id": string }; Returns: undefined
                           },
"intrack_bind_specialized_requirement":
{ Args: { "command_id": string,"payload": Json }; Returns: Json
                           },
"intrack_can_resume_password_change":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"intrack_can_upload_requirement":
{ Args: { "object_name": string }; Returns: boolean
                           },
"intrack_can_upload_template":
{ Args: { "object_name": string }; Returns: boolean
                           },
"intrack_check_activation":
{ Args: { "notice_version": string,"subject": string }; Returns: Json
                           },
"intrack_claim_template_cleanup":
{ Args: { "batch_size"?: number }; Returns: Json
                           },
"intrack_class_join_administration":
{ Args: { "actor_role": string }; Returns: Json
                           },
"intrack_class_roster":
{ Args: { "actor_role": string,"class_id": string }; Returns: Json
                           },
"intrack_commit_masterlist":
{ Args: { "command_id": string,"validation_token": string }; Returns: Json
                           },
"intrack_complete_requirement_cleanup":
{ Args: { "document_id": string }; Returns: undefined
                           },
"intrack_configure_email_domains":
{ Args: { "approval_reference": string,"program_code": string,"staff_domains": (string)[],"student_domains": (string)[] }; Returns: undefined
                           },
"intrack_configure_placement":
{ Args: { "command_id": string,"payload": Json }; Returns: Json
                           },
"intrack_coordinator_roster":
{ Args: { "account_role": string,"filters"?: Json }; Returns: Json
                           },
"intrack_create_academic_term":
{ Args: { "actor_role": string,"command_id": string,"payload": Json }; Returns: Json
                           },
"intrack_create_ojt_class":
{ Args: { "actor_role": string,"command_id": string,"payload": Json }; Returns: Json
                           },
"intrack_create_practicum_class":
{ Args: { "actor_role": string,"command_id": string,"payload": Json }; Returns: Json
                           },
"intrack_dtr_command":
{ Args: { "command_id": string,"payload": Json }; Returns: Json
                           },
"intrack_enroll_practicum_class":
{ Args: { "actor_role": string,"command_id": string,"payload": Json }; Returns: Json
                           },
"intrack_enroll_student":
{ Args: { "command_id": string,"payload": Json }; Returns: Json
                           },
"intrack_enrollment_configuration":
{ Args: { "actor_role": string,"filters"?: Json }; Returns: Json
                           },
"intrack_enrollment_report":
{ Args: { "actor_role": string,"page_offset"?: number,"page_size"?: number,"search_text"?: string }; Returns: Json
                           },
"intrack_evaluation_command":
{ Args: { "command_id": string,"payload": Json }; Returns: Json
                           },
"intrack_expired_requirement_files":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"intrack_export_enrollments":
{ Args: { "actor_role": string,"command_id": string,"page_offset"?: number,"search_text"?: string }; Returns: Json
                           },
"intrack_finalization_command":
{ Args: { "command_id": string,"payload": Json }; Returns: Json
                           },
"intrack_finish_recovery_session":
{ Args: { "subject": string,"verified_session": string }; Returns: boolean
                           },
"intrack_finish_password_decision":
{ Args: { "notice_version": string,"password_changed": boolean,"subject": string }; Returns: Json
                           },
"intrack_get_my_identity":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"intrack_invalidate_coordinator_sessions":
{ Args: { "reason": string,"subject": string }; Returns: undefined
                           },
"intrack_lifecycle_command":
{ Args: { "command_id": string,"payload": Json }; Returns: Json
                           },
"intrack_link_account_invitation":
{ Args: { "auth_user_id": string,"invitation_id": string }; Returns: Json
                           },
"intrack_link_first_coordinator":
{ Args: { "auth_user_id": string,"command_id": string,"reconciliation_reason"?: string }; Returns: Json
                           },
"intrack_link_whitelist":
{ Args: { "auth_user_id": string,"invitation_id": string }; Returns: Json
                           },
"intrack_list_academics":
{ Args: { "actor_role": string,"enrollment_id": string }; Returns: Json
                           },
"intrack_list_account_invitations":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"intrack_list_announcements":
{ Args: { "actor_role": string,"before_id"?: string,"page_size"?: number }; Returns: Json
                           },
"intrack_list_assessments":
{ Args: { "actor_role": string,"enrollment_id": string }; Returns: Json
                           },
"intrack_list_attendance":
{ Args: { "actor_role": string,"before_date"?: string,"enrollment_id": string }; Returns: Json
                           },
"intrack_list_dtrs":
{ Args: { "actor_role": string,"enrollment_id": string }; Returns: Json
                           },
"intrack_list_enrollments":
{ Args: { "actor_role": string }; Returns: Json
                           },
"intrack_list_messages":
{ Args: { "actor_role": string,"before_id"?: string,"enrollment_id": string,"page_size"?: number }; Returns: Json
                           },
"intrack_list_notifications":
{ Args: { "actor_role": string,"before_id"?: string,"page_size"?: number }; Returns: Json
                           },
"intrack_list_requirements":
{ Args: { "actor_role": string }; Returns: Json
                           },
"intrack_list_template_links":
{ Args: { "actor_role": string }; Returns: Json
                           },
"intrack_list_templates":
{ Args: { "actor_role": string,"page_offset"?: number,"program_code": string }; Returns: Json
                           },
"intrack_login_email_exists":
{ Args: { "address": string }; Returns: boolean
                           },
"intrack_manage_class_code":
{ Args: { "actor_role": string,"command_id": string,"payload": Json }; Returns: Json
                           },
"intrack_my_class_join_requests":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"intrack_operator_health":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"intrack_password_recovery_status":
{ Args: { "address": string }; Returns: string
                           },
"intrack_portfolio_command":
{ Args: { "command_id": string,"payload": Json }; Returns: Json
                           },
"intrack_preview_masterlist":
{ Args: { "rows": Json }; Returns: Json
                           },
"intrack_program_checklist":
{ Args: { "actor_role": string,"program_id": string }; Returns: Json
                           },
"intrack_publish_announcement":
{ Args: { "command_id": string,"payload": Json }; Returns: Json
                           },
"intrack_publish_policy":
{ Args: { "command_id": string,"payload": Json }; Returns: Json
                           },
"intrack_publish_practicum_policy":
{ Args: { "command_id": string,"payload": Json }; Returns: Json
                           },
"intrack_publish_rubric":
{ Args: { "command_id": string,"payload": Json }; Returns: Json
                           },
"intrack_read_message":
{ Args: { "actor_role": string,"command_id": string,"message_id": string }; Returns: Json
                           },
"intrack_read_notification":
{ Args: { "actor_role": string,"command_id": string,"notification_id": string }; Returns: Json
                           },
"intrack_reconstruction_command":
{ Args: { "command_id": string,"payload": Json }; Returns: Json
                           },
"intrack_record_login_email":
{ Args: { "email_session": string,"password_session": string,"subject": string }; Returns: undefined
                           },
"intrack_record_password_change":
{ Args: { "subject": string,"verified_session": string }; Returns: undefined
                           },
"intrack_register_whitelist":
{ Args: { "invitation_id": string }; Returns: Json
                           },
"intrack_request_class_join":
{ Args: { "command_id": string,"payload": Json }; Returns: Json
                           },
"intrack_requirement_command":
{ Args: { "action": string,"command_id": string,"payload": Json }; Returns: Json
                           },
"intrack_requirement_file":
{ Args: { "actor_role": string,"document_id": string }; Returns: Json
                           },
"intrack_reserve_account_invitation":
{ Args: { "command_id": string,"payload": Json }; Returns: Json
                           },
"intrack_reserve_first_coordinator":
{ Args: { "command_id": string,"display_name": string,"email": string,"program_codes": (string)[],"reason": string }; Returns: Json
                           },
"intrack_resolution_file_command":
{ Args: { "action": string,"command_id": string,"payload": Json }; Returns: Json
                           },
"intrack_resume_password_change":
{ Args: { "subject": string,"verified_session": string,"password_session": string }; Returns: boolean
                           },
"intrack_review_class_join":
{ Args: { "actor_role": string,"command_id": string,"payload": Json }; Returns: Json
                           },
"intrack_revoke_approval":
{ Args: { "command_id": string,"payload": Json }; Returns: Json
                           },
"intrack_route_moa":
{ Args: { "command_id": string,"payload": Json }; Returns: Json
                           },
"intrack_save_adviser_roster_details":
{ Args: { "command_id": string,"expected_revision": number,"membership_id": string,"phone": string,"sections": (string)[] }; Returns: Json
                           },
"intrack_save_program_checklist":
{ Args: { "actor_role": string,"command_id": string,"payload": Json }; Returns: Json
                           },
"intrack_save_template_link":
{ Args: { "command_id": string,"payload": Json }; Returns: Json
                           },
"intrack_send_message":
{ Args: { "actor_role": string,"body": string,"command_id": string,"enrollment_id": string,"recipient_id": string }; Returns: Json
                           },
"intrack_set_membership":
{ Args: { "command_id": string,"expected_revision": number,"make_active": boolean,"membership_id": string,"reason": string }; Returns: Json
                           },
"intrack_student_portal_profile":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"intrack_submit_physical_requirement":
{ Args: { "command_id": string,"payload": Json }; Returns: Json
                           },
"intrack_template_command":
{ Args: { "action": string,"command_id": string,"payload": Json }; Returns: Json
                           },
"intrack_template_file":
{ Args: { "actor_role": string,"template_id": string }; Returns: Json
                           },
"intrack_template_upload_context":
{ Args: { "upload_id": string }; Returns: Json
                           },
"intrack_verify_physical_requirement":
{ Args: { "command_id": string,"payload": Json }; Returns: Json
                           },
"intrack_waive_requirement":
{ Args: { "command_id": string,"payload": Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "intrack": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
