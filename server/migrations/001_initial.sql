CREATE TABLE users (
  id uuid PRIMARY KEY,
  name varchar(100) NOT NULL,
  email varchar(254) NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role varchar(10) NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (email = lower(email))
);

CREATE INDEX users_role_idx ON users (role);

CREATE TABLE courses (
  id varchar(100) PRIMARY KEY,
  title varchar(200) NOT NULL,
  title_ar varchar(200) NOT NULL,
  category varchar(100) NOT NULL,
  category_ar varchar(100) NOT NULL,
  instructor varchar(150) NOT NULL,
  instructor_ar varchar(150) NOT NULL,
  description varchar(5000) NOT NULL,
  description_ar varchar(5000) NOT NULL,
  level varchar(50) NOT NULL,
  image varchar(2000) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX courses_category_idx ON courses (lower(category));

CREATE TABLE lessons (
  id varchar(100) PRIMARY KEY,
  course_id varchar(100) NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title varchar(200) NOT NULL,
  title_ar varchar(200) NOT NULL,
  content varchar(20000) NOT NULL,
  content_ar varchar(20000) NOT NULL,
  duration integer NOT NULL CHECK (duration BETWEEN 1 AND 600),
  position integer NOT NULL CHECK (position >= 0),
  UNIQUE (course_id, position)
);

CREATE TABLE enrollments (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id varchar(100) NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, course_id)
);

CREATE INDEX enrollments_course_idx ON enrollments (course_id);

CREATE TABLE lesson_progress (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id varchar(100) NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  completed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, lesson_id)
);

CREATE INDEX lesson_progress_lesson_idx ON lesson_progress (lesson_id);

CREATE TABLE user_sessions (
  sid varchar NOT NULL PRIMARY KEY,
  sess json NOT NULL,
  expire timestamp(6) NOT NULL
);

CREATE INDEX user_sessions_expire_idx ON user_sessions (expire);
