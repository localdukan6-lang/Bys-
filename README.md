# BYS ASSOCIATE JOB — Starter Project

This project contains:
- `public/index.html` — Sarkari-Result-inspired home page
- `public/job.html` — full job details and application-interest form
- `public/admin.html` — admin login, job add/edit/delete and application status management
- `src/server.js` — Express API
- MongoDB database models for jobs and applications

## 1. Requirements
Install Node.js 18+ and create a MongoDB database (local MongoDB or MongoDB Atlas).

## 2. Setup
```bash
npm install
```
Copy `.env.example` to `.env` and set:
- `MONGODB_URI`
- a long random `JWT_SECRET`
- `ADMIN_USERNAME`
- a strong `ADMIN_PASSWORD`

Never publish your `.env` file or commit it to GitHub.

## 3. Run
```bash
npm run dev
```
Open:
- Home: http://localhost:5000/
- Job details: open a job from the home page
- Admin: http://localhost:5000/admin.html

The first admin account is configured through environment variables. There is no public admin registration.

## 4. Deploy
Deploy the Node app to Render or another Node host and add the environment variables in the hosting dashboard. Use MongoDB Atlas for the database. The same Express app serves the `public` folder, so point the domain to this backend or configure a frontend proxy to the backend.

## Important application note
The built-in application form registers the candidate's interest in BYS ASSOCIATE JOB and stores it in the portal. If a recruitment organization has its own official application website, candidates must also use the `Apply Online` official link. Do not claim that this internal form is the employer's official recruitment application unless you have an authorized integration.

## Before going live
- Replace the sample brand/domain text if needed.
- Add your real contact, privacy policy, terms and disclaimer.
- Use HTTPS.
- Use a strong unique admin password and JWT secret.
- Add a privacy-compliant document upload flow only if you really need candidates' ID or certificates; this starter intentionally does not collect sensitive documents.
- Configure backups and test admin access before publishing.
