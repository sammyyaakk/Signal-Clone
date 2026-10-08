# Signal Clone

A Signal Desktop–style messenger with real-time 1:1 and group chat, delivery/read receipts, typing indicators and presence.

**Live demo:** https://signal-clone-jet-xi.vercel.app · **API docs:** https://signal-clone-api-uwz6.onrender.com/docs · Log in with `+15550000001` and code `123456`

> The API runs on Render's free tier and sleeps when idle. The first request after a while can take ~50 seconds to wake it.

> Built for the Scaler SDE Fullstack assignment. Not affiliated with or endorsed by Signal Messenger LLC; the Signal name and logo belong to their owners.

**Contents:** [Setup](#setup) · [Features](#features) · [Architecture](#architecture) · [Database schema](#database-schema) · [API](#api-overview) · [Deployment](#deployment) · [Assumptions](#assumptions-and-trade-offs) · [Error log](ERROR_LOG.md)

- **Frontend:** Next.js (App Router, TypeScript), Zustand for client state, plain CSS with theme tokens (light + dark)
- **Backend:** FastAPI, SQLAlchemy 2.0 ORM, SQLite
- **Real-time:** native WebSockets (FastAPI ↔ browser)

## Setup

**Backend** (Python 3.11+):

```bash
cd backend
python -m venv .venv
.venv/Scripts/activate        # Windows; use `source .venv/bin/activate` on macOS/Linux
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

On first start, the app creates `signal.db` and seeds demo data. API docs: http://localhost:8000/docs

**Frontend** (Node 20+):

```bash
cd frontend
npm install
cp .env.example .env.local    # NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev
```

Open http://localhost:3000.

**Demo logins** (verification code is always `123456`):

| Phone | User |
|---|---|
| +15550000001 | Alice Johnson |
| +15550000002 | Bob Smith |
| +15550000003 | Carol Diaz |
| +15550000004 | Dave Lee |
| +15550000005 | Eve Patel |

A new number registers a new account and goes through profile setup. To see real-time features, log in as two different users in two browsers (or one normal and one private window).

## Features

- **Onboarding:** phone number → mocked OTP → display name and avatar color. The session token is kept in localStorage, so a reload keeps you logged in. Logout lives in Settings.
- **Chat list:** sorted by latest activity, unread badges, last-message preview ("You: …", "Sender: …" in groups), live "typing…", online dot, search over chats and contacts, "Unread" filter.
- **1:1 messaging:** real-time send and receive, timestamps, day separators, grouped bubbles, typing indicator, online / last seen.
- **Message status:** Signal's indicators: sending (dashed ring) → sent (ring with ✓) → delivered (two rings) → read (two filled circles), shown on bubbles and in the chat list.
- **Groups:** create with a name and members; view members; admins add and remove members; anyone can leave. If the last admin leaves, the longest-standing member is promoted.
- **Signal experience:** nav rail (Chats / Calls / Stories / Settings, where clicking Settings again closes it), conversation list + chat pane, a chat options menu (⋯), hover actions on messages (react, plus a menu where Copy works), modals, toasts (including new-message notifications), and Settings with profile editing, Appearance (light/dark), and Privacy / Notifications / Linked devices placeholders.
- **Design system:** Signal's colour tokens for light and dark, Inter type scale, Lucide stroke icons, bubbles with a 4px tail that tighten on the stacked side, a floating date pill, and 220ms ease-out transitions.
- **Placeholders:** calls, stories, attachments, voice notes, emoji and linked devices show "coming soon". Encryption is simulated (UI notice only).
- **Extras:** dark mode, `Ctrl/Cmd+N` for a new chat, narrow-screen layout (list *or* chat).

## Architecture

```
frontend/src
  app/            page.tsx (session gate), layout, globals.css (theme tokens + styles)
  lib/            api.ts (REST client), socket.ts (WS with auto-reconnect), format.ts (pure helpers), types.ts, theme.ts
  store/chat.ts   Zustand store: single source of truth for user, chats, messages, presence, typing, toasts
  hooks/          useRealtime.ts maps server events to store actions
  components/     Onboarding, Messenger (shell), NavRail, SettingsPanel,
                  chats/ (list), chat/ (pane, message list, bubble, composer), modals/, ui/ (Avatar, Icon, Modal, …)

backend/app
  main.py         app factory: CORS, routers, create tables + seed on startup
  models.py       SQLAlchemy models (schema below)
  schemas.py      Pydantic request/response models
  deps.py         bearer-token auth dependency
  services.py     shared conversation logic (membership checks, serialization, receipts, push helpers)
  realtime.py     ConnectionManager: user id → open sockets, fan-out
  routers/        auth, users, contacts, conversations, ws
  seed.py         demo data
```

**Data flow:** writes go over REST, so every mutation is validated and persisted before anyone hears about it. After the DB commit, the server pushes events over the WebSocket to the affected members. The client applies those events to the store, and components re-render from the store. Sending is optimistic: the bubble appears right away as "sending", then the persisted message replaces it. Duplicates are dropped by id, so it doesn't matter whether the REST response or the socket event arrives first.

## Database schema

```
users                 id PK, phone UNIQUE, display_name, avatar_color, about, last_seen_at, created_at
sessions              token PK, user_id FK→users            (one row per logged-in device; logout deletes it)
contacts              (owner_id, contact_id) PK, both FK→users, created_at
conversations         id PK, kind ('direct'|'group'), name, direct_key UNIQUE, created_by FK→users,
                      created_at, last_activity_at (indexed, drives list ordering)
conversation_members  (conversation_id, user_id) PK, role ('admin'|'member'), joined_at,
                      last_delivered_id, last_read_id
messages              id PK, conversation_id FK, sender_id FK, body, created_at
                      INDEX (conversation_id, id)
```

Design decisions:

- **One table for 1:1 and groups.** A direct chat is a conversation with two members. `direct_key` (`"<lowId>:<highId>"`) is UNIQUE, so the database itself guarantees at most one chat per pair.
- **Receipts as per-member watermarks**, not one row per message per recipient. Each member stores the highest message id delivered to them and read by them. A message is *delivered* or *read* once every other member's watermark reaches its id. That's O(members) storage instead of O(messages × members), and unread count = messages after my `last_read_id` that someone else sent.
- **Delivery** is recorded when the recipient has an open socket at send time, or as soon as they reconnect.
- Foreign keys are enforced (`PRAGMA foreign_keys=ON`) with `ON DELETE CASCADE` where ownership is clear.

## API overview

All endpoints except `/auth/verify` require `Authorization: Bearer <token>`. Interactive docs are at `/docs`.

| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/verify` | `{phone, otp}` → `{token, user, needs_profile}`; registers new numbers |
| POST | `/auth/logout` | revoke current session |
| GET / PATCH | `/users/me` | current profile / update name, about, avatar color |
| GET / POST | `/contacts` | list contacts / add a contact by phone |
| GET | `/conversations` | my conversations with members, last message and unread count |
| POST | `/conversations/direct` | `{user_id}` → get or create a 1:1 chat |
| POST | `/conversations/group` | `{name, member_ids}` → create a group (creator is admin) |
| GET / POST | `/conversations/{id}/messages` | message history / send a message |
| POST | `/conversations/{id}/read` | `{message_id}` → advance my read watermark |
| POST | `/conversations/{id}/members` | admin: add members |
| DELETE | `/conversations/{id}/members/{user_id}` | admin: remove a member; or remove yourself to leave |
| WS | `/ws?token=…` | real-time channel |

WebSocket events, server → client: `message`, `receipt`, `typing`, `presence`, `presence_snapshot`, `conversation`, `conversation_removed`. Client → server: `typing`.

## Deployment

| | Backend (Render, Web Service) | Frontend (Vercel) |
|---|---|---|
| Root directory | `backend` | `frontend` |
| Build | `pip install -r requirements.txt` | auto (Next.js) |
| Start | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` | auto |
| Env vars | `PYTHON_VERSION=3.12.7` | `NEXT_PUBLIC_API_URL=https://<service>.onrender.com` |

Optional backend env vars: `CORS_ORIGINS` (comma-separated, default `*`) and `DATABASE_URL` (default `sqlite:///./signal.db`).

## Assumptions and trade-offs

- Phone verification and E2E encryption are mocked, as the brief allows. Session tokens are random opaque strings stored server-side.
- Connection state is held in-process, which is correct for one server instance. Scaling out would need a pub/sub layer such as Redis.
- On Render's free tier the filesystem is ephemeral, so the SQLite DB resets on redeploy or restart. The seed recreates the demo data automatically.
- Presence is broadcast to all connected users, which is fine at demo scale. A production version would scope it to contacts.
- The conversation list computes last message and unread count per conversation (N+1 queries), which is fine for this data size and keeps the code simple.
