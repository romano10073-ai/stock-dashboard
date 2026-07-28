-- 내 포트폴리오 대시보드: 회원가입/로그인 이력용 테이블
--
-- 참고: 현재 연결된 Supabase 프로젝트(tmzpoptpvbonzngvblhc)에는 이미 users/login_history
-- 테이블과 app_signup/app_login RPC 함수가 준비되어 있어 server.js가 이를 그대로 사용합니다.
-- 이 파일은 실행할 필요가 없습니다 — 처음부터 새 Supabase 프로젝트로 시작할 때 참고용 스키마입니다.
-- (이 경우 app_signup/app_login RPC도 별도로 만들어야 하며, 이 파일에는 테이블만 포함되어 있습니다.)
--
-- 서버(server.js)는 service_role/secret 키로만 접근하므로 RLS는 모두 막아두고,
-- anon/authenticated 역할에는 어떤 권한도 주지 않습니다(클라이언트 직접 접근 차단).

create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  employee_id text not null unique,
  name text not null,
  phone text not null,
  created_at timestamptz not null default now()
);

create table if not exists login_history (
  id uuid primary key default gen_random_uuid(),
  employee_id text not null,
  name text not null,
  logged_in_at timestamptz not null default now()
);

alter table users enable row level security;
alter table login_history enable row level security;
-- 정책을 하나도 만들지 않으면 anon/authenticated 로는 어떤 행도 조회/수정할 수 없고,
-- service_role 키(서버 전용)만 RLS를 우회해 접근할 수 있습니다.
