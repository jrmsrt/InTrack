# InTrack

**Web-Based OJT Student Attendance, Task Management, and Progress Monitoring System**

InTrack supports OJT students, advisers, and coordinators through attendance recording, task and journal tracking, document reviews, and OJT progress monitoring.

## Supabase preparation

The target backend is **Supabase PostgreSQL, Auth, and private Storage**. Read [the part-by-part specification](docs/backend-readiness.md), [the operation and permission matrix](docs/operation-matrix.md), and [the integration acceptance checklist](docs/integration-checklist.md) before integration.

Owner-supplied training requirements are BSIT 500 hours in 4th year/2nd semester; BSHM 300 hours in 2nd-year summer and 600 hours in 4th year/2nd semester; BSCPE 300 hours in each of 2nd-year and 3rd-year summer; and BSOA 300 hours in each of 2nd and 4th year, with semester/term labels still unset. There is no company-supervisor application role. MOA status is coordinator-controlled and uses seven statuses, including SAS COPY SUBMITTED when the signed and notarized copy has been submitted to SAS.

`database/supabase-model.sql` is a relational blueprint with a restrictive access baseline, not an applied migration or a connected backend. `src/app/domain/` contains the new contracts, program requirements, and tested policy helpers. The legacy screens are not yet connected to these new rules. Existing prototype settings and persisted snapshots must be reconciled during integration rather than copied blindly.

The only implemented adapter is `VITE_BACKEND_MODE=demo`. Other values show an integration-pending screen before mounting legacy contexts. Simulator controls are available only in development demo mode. Do not use real credentials or personal records in the demo. Run `npm test` with a Node version that supports TypeScript stripping to check the preparation rules.

The MySQL setup below documents the **legacy demonstration backend**. It is not the setup procedure for the planned Supabase backend. To review only the frontend, use `npm run dev:client`.

Part 7 adds isolated PostgreSQL validation: `npm run test:database` checks the executed schema, and `npm run db:prepare` freezes a migration candidate plus inventory. See [database preparation and migration order](database/README.md). PGlite is a development-only test engine, not the application's backend. Actual Supabase Auth/Storage/RLS/RPC integration remains pending.

## Project structure

- `src/main.tsx` and `src/app/` contain the React and TypeScript frontend.
  - `src/app/pages/` groups screens by role (`student/`, `adviser/`, `coordinator/`, `auth/`, and `shared/`).
  - `src/app/components/` groups interface components by purpose: `auth/`, `forms/`, `shared/`, and reusable UI primitives in `ui/`.
  - `src/app/context/`, `src/app/data/`, and `src/app/lib/` hold application state, reference data, and shared utilities.
  - `src/styles/` contains the global stylesheets.
- `api/` contains the FastAPI backend; `main.py` defines the endpoints, `config.py` loads settings, and `services/` groups database and email integrations.
- `database/schema.sql` defines the MySQL tables.
- `public/` contains static images used by the interface and generated forms.
- `tests/` contains frontend tests.
- `vite.config.ts`, `package.json`, and `requirements.txt` configure the frontend tooling and Python backend dependencies.

The browser app uses Vite at port 5173 and sends `/api` requests through Vite's proxy to FastAPI at port 3001.

## How to Run the App from a Downloaded ZIP File

Follow these steps if you received this project as a ZIP file.

### 1. Install Node.js

Before running the app, install Node.js from:

https://nodejs.org/

Use the LTS version. After installing, restart your terminal or command prompt.

To check if Node.js is installed, run:

```bash
node -v
npm -v
```

Both commands should show version numbers.

### 2. Download and Extract the ZIP File

1. Download the project ZIP file.
2. Right-click the ZIP file and choose **Extract All**.
3. Open the extracted folder.

Make sure the folder contains files such as:

```text
package.json
package-lock.json
src
public
vite.config.ts
```

### 3. Open the Project Folder in a Terminal

Open a terminal or command prompt inside the extracted project folder.

On Windows, you can:

1. Open the extracted folder.
2. Click the address bar.
3. Type `cmd`.
4. Press Enter.

### 4. Install the App Packages

Run these commands once:

```bash
npm install
python -m pip install -r requirements.txt
```

This downloads the website packages into `node_modules` and installs the FastAPI backend packages for Python.

### 5. Set Up MySQL Workbench

1. Open MySQL Workbench and connect to your local MySQL server.
2. Open `database/schema.sql`.
3. Run the full script. It creates the `pup_intrack` database and the tables used by the app.
4. Confirm that the `authorized_students` table contains the initial student whitelist.
5. Copy `.env.example` to a new file named `.env`.
6. In `.env`, update `DB_USER` and `DB_PASSWORD` to match your MySQL Workbench connection.

`.env` is the single local settings file for the app, operator commands, Supabase functions, and SMTP. Only variables prefixed with `VITE_` are available to browser code. For Node operator commands, load it with `node --env-file=.env`; for local Supabase functions, use `npx supabase functions serve --env-file .env`.

Example:

```text
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=pup_intrack
API_PORT=3001
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_sender_email@gmail.com
SMTP_PASS=your_app_password
SMTP_FROM="InTrack - OJT Monitoring System <your_sender_email@gmail.com>"
```

The OTP sender uses SMTP. If the SMTP fields are blank, the local API will generate the OTP email in the server output for development. Add real SMTP credentials before using the app with students.

### 6. Start the App

Run:

```bash
npm run dev
```

The terminal starts both the database API and the website. The website address is usually:

```text
http://localhost:5173/
```

Open that address in your browser. The app API runs at:

```text
http://localhost:3001/
```

FastAPI's interactive API docs are available at:

```text
http://localhost:3001/docs
```

### 7. Stop the App

To stop the app, go back to the terminal and press:

```text
Ctrl + C
```

Then type `Y` if the terminal asks for confirmation.

## Optional: Build the App

To create a production build, run:

```bash
npm run build
```

The finished files will be created in the `dist` folder.

To preview the production build locally, run:

```bash
npm run preview
```

## Troubleshooting

If `npm install` fails, make sure Node.js is installed correctly and that you are inside the extracted project folder.

If the browser does not open automatically, copy the local address from the terminal and paste it into your browser.

If port `5173` is already being used, Vite may show a different local address. Use the address shown in the terminal.

## Authentication and review notes

The current authentication implementation is a local demonstration flow. Account lookup, passwords, the active user, OTP state, and role routing are handled in browser code and browser storage. Until email delivery is integrated, the generated OTP is shown on the OTP page in Vite development mode and printed by the local API mail fallback. That preview is omitted from production builds. The API's database, authorized-student, privacy-consent, and OTP endpoints do not require an authenticated session. Frontend role checks improve navigation behavior but do not protect API data or operations from direct requests.

Do not deploy this version with real student information or real credentials. A production deployment needs server-side authentication and authorization, and demo credentials must be replaced and rotated. When SMTP is not configured, the local development mail transport writes OTP details to the API terminal so a developer can complete the activation flow.

Some screens also initialize from sample OJT records in `src/app/context/OJTContext.tsx` for local demonstrations. Treat those records as sample data, not production records.
