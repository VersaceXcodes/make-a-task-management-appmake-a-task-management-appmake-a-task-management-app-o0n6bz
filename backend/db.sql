-- ==========================
-- Table: users
-- ==========================
CREATE TABLE users (
  user_id       BIGINT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'regular',
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  notification_settings JSON NOT NULL DEFAULT '{"in_app": true, "email": false}'
);

-- ==========================
-- Table: tasks
-- ==========================
CREATE TABLE tasks (
  task_id        BIGINT PRIMARY KEY,
  creator_user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  description    TEXT,
  due_date       TEXT,
  priority       TEXT NOT NULL DEFAULT 'Medium',
  status         TEXT NOT NULL DEFAULT 'To Do',
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  tags           JSON NOT NULL DEFAULT '[]'
);

-- ==========================
-- Table: task_assignees
-- Composite primary key (task_id, user_id)
-- ==========================
CREATE TABLE task_assignees (
  task_id      BIGINT NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
  user_id      BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  assigned_at  TEXT NOT NULL,
  PRIMARY KEY (task_id, user_id)
);

-- ==========================
-- Table: task_comments
-- ==========================
CREATE TABLE task_comments (
  comment_id         BIGINT PRIMARY KEY,
  task_id            BIGINT NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
  author_user_id     BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  body               TEXT NOT NULL,
  created_at         TEXT NOT NULL,
  updated_at         TEXT,
  parent_comment_id  BIGINT REFERENCES task_comments(comment_id) ON DELETE SET NULL
);

-- ==========================
-- Table: notifications
-- ==========================
CREATE TABLE notifications (
  notification_id BIGINT PRIMARY KEY,
  user_id         BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  type            TEXT NOT NULL,
  reference_id    BIGINT,
  message         TEXT NOT NULL,
  is_read         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TEXT NOT NULL
);

-- Note: reference_id can reference either tasks.task_id or task_comments.comment_id depending on type.
-- No direct FK constraint for polymorphic reference in MVP.

-- ==========================
-- Table: task_reminders
-- ==========================
CREATE TABLE task_reminders (
  reminder_id  BIGINT PRIMARY KEY,
  task_id      BIGINT NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
  remind_at    TEXT NOT NULL,
  preset       TEXT NOT NULL,
  created_at   TEXT NOT NULL
);

-- ==========================
-- Table: user_invitations
-- ==========================
CREATE TABLE user_invitations (
  invitation_id     BIGINT PRIMARY KEY,
  inviter_user_id   BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  invitee_email     TEXT NOT NULL,
  team_id           BIGINT,
  invitation_token  TEXT NOT NULL UNIQUE,
  status            TEXT NOT NULL DEFAULT 'pending',
  sent_at           TEXT NOT NULL
  -- team_id nullable, FK to teams.team_id excluded in MVP as teams table not implemented
);

-- ==========================
-- Indexes for performance (optional but recommended)
-- ==========================
CREATE INDEX idx_tasks_creator_user_id ON tasks (creator_user_id);
CREATE INDEX idx_task_assignees_user_id ON task_assignees (user_id);
CREATE INDEX idx_task_comments_task_id ON task_comments (task_id);
CREATE INDEX idx_task_comments_author_user_id ON task_comments (author_user_id);
CREATE INDEX idx_notifications_user_id ON notifications (user_id);
CREATE INDEX idx_task_reminders_task_id ON task_reminders (task_id);
CREATE INDEX idx_user_invitations_inviter_user_id ON user_invitations (inviter_user_id);
CREATE INDEX idx_user_invitations_status ON user_invitations (status);

-- ==========================
-- Seed Data
-- ==========================

-- USERS
INSERT INTO users (user_id, email, password_hash, name, role, created_at, updated_at, notification_settings) VALUES
-- Manually assigned user_ids; no UID generated in DB!
(1, 'alice@example.com', 'hashed_pw_alice', 'Alice Johnson', 'manager', '2024-06-01T08:00:00Z', '2024-06-01T08:00:00Z', '{"in_app": true, "email": false}'),
(2, 'bob@example.com', 'hashed_pw_bob', 'Bob Smith', 'regular', '2024-06-02T09:30:00Z', '2024-06-02T09:30:00Z', '{"in_app": true, "email": true}'),
(3, 'carol@example.com', 'hashed_pw_carol', 'Carol Williams', 'regular', '2024-06-02T10:15:00Z', '2024-06-02T10:15:00Z', '{"in_app": false, "email": true}'),
(4, 'david@example.com', 'hashed_pw_david', 'David Brown', 'regular', '2024-06-03T11:45:00Z', '2024-06-03T11:45:00Z', '{"in_app": true, "email": true}'),
(5, 'eve@example.com', 'hashed_pw_eve', 'Eve Davis', 'manager', '2024-06-04T07:10:00Z', '2024-06-04T07:10:00Z', '{"in_app": true, "email": false}');

-- TASKS
INSERT INTO tasks (task_id, creator_user_id, title, description, due_date, priority, status, created_at, updated_at, tags) VALUES
(101, 1, 'Design new feature UI', 'Create wireframes and mockups for the new dashboard feature.', '2024-06-30T17:00:00Z', 'High', 'To Do', '2024-06-05T08:00:00Z', '2024-06-05T08:00:00Z', '["urgent","frontend","clientA"]'),
(102, 2, 'Fix login bug', 'Users cannot login when using special characters in password.', '2024-06-15T12:00:00Z', 'Medium', 'In Progress', '2024-06-06T09:00:00Z', '2024-06-10T14:30:00Z', '["bug","backend"]'),
(103, 3, 'Write API documentation', 'Document all endpoints for TaskMaster API v1.', NULL, 'Low', 'To Do', '2024-06-07T10:00:00Z', '2024-06-07T10:00:00Z', '["documentation"]'),
(104, 1, 'Set up testing environment', 'Prepare integration tests for critical workflows.', '2024-07-01T09:00:00Z', 'Medium', 'To Do', '2024-06-08T11:00:00Z', '2024-06-08T11:00:00Z', '["testing","ci"]'),
(105, 5, 'Plan quarterly roadmap', 'Create roadmap presentation for next quarter.', '2024-06-20T15:00:00Z', 'High', 'In Progress', '2024-06-09T12:00:00Z', '2024-06-11T10:00:00Z', '["planning","management"]');

-- TASK_ASSIGNEES
INSERT INTO task_assignees (task_id, user_id, assigned_at) VALUES
(101, 2, '2024-06-05T09:00:00Z'),
(101, 3, '2024-06-05T09:05:00Z'),
(102, 2, '2024-06-06T09:10:00Z'),
(103, 3, '2024-06-07T10:15:00Z'),
(104, 4, '2024-06-08T11:15:00Z'),
(105, 5, '2024-06-09T12:05:00Z'),
(105, 1, '2024-06-09T12:10:00Z');

-- TASK_COMMENTS
INSERT INTO task_comments (comment_id, task_id, author_user_id, body, created_at, updated_at, parent_comment_id) VALUES
(201, 101, 2, 'I started working on the wireframes, will share soon.', '2024-06-05T10:00:00Z', NULL, NULL),
(202, 101, 3, 'Please consider accessibility guidelines in the designs.', '2024-06-05T11:30:00Z', NULL, 201),
(203, 102, 2, 'Bug reproduced, looking into root cause.', '2024-06-06T10:00:00Z', '2024-06-06T12:00:00Z', NULL),
(204, 105, 5, 'We should align this with marketing team.', '2024-06-09T13:00:00Z', NULL, NULL),
(205, 101, 1, 'Make sure client is consulted before finalizing UI.', '2024-06-05T12:00:00Z', NULL, NULL),
(206, 103, 3, 'Started drafting intro section.', '2024-06-07T12:00:00Z', NULL, NULL),
(207, 104, 4, 'CI pipeline integration pending.', '2024-06-08T12:30:00Z', NULL, NULL);

-- NOTIFICATIONS
INSERT INTO notifications (notification_id, user_id, type, reference_id, message, is_read, created_at) VALUES
(301, 2, 'task_assignment', 101, 'You have been assigned to task "Design new feature UI".', FALSE, '2024-06-05T09:01:00Z'),
(302, 3, 'task_assignment', 101, 'You have been assigned to task "Design new feature UI".', FALSE, '2024-06-05T09:05:00Z'),
(303, 2, 'task_update', 102, 'Task "Fix login bug" status changed to In Progress.', TRUE, '2024-06-10T14:31:00Z'),
(304, 5, 'new_comment', 204, 'New comment on task "Plan quarterly roadmap".', FALSE, '2024-06-09T13:05:00Z'),
(305, 1, 'reminder', 101, 'Reminder: Task "Design new feature UI" is due soon.', FALSE, '2024-06-29T17:00:00Z');

-- TASK_REMINDERS
INSERT INTO task_reminders (reminder_id, task_id, remind_at, preset, created_at) VALUES
(401, 101, '2024-06-30T16:00:00Z', '1_hour_before', '2024-06-05T08:05:00Z'),
(402, 102, '2024-06-14T12:00:00Z', '1_day_before', '2024-06-06T09:10:00Z'),
(403, 105, '2024-06-20T14:00:00Z', '1_hour_before', '2024-06-09T12:15:00Z');

-- USER_INVITATIONS
INSERT INTO user_invitations (invitation_id, inviter_user_id, invitee_email, team_id, invitation_token, status, sent_at) VALUES
(501, 1, 'frank@example.com', NULL, 'token123abc', 'pending', '2024-06-05T15:00:00Z'),
(502, 5, 'grace@example.com', NULL, 'token456def', 'accepted', '2024-06-07T09:00:00Z'),
(503, 1, 'heidi@example.com', NULL, 'token789ghi', 'declined', '2024-06-08T11:30:00Z');

-- ==========================
-- All schema creation and sample seed data complete.
-- ==========================