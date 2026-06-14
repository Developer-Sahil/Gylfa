# Deployment Guide: Gylfa

This guide provides instructions for deploying the Gylfa application to production using **MongoDB Atlas**, **Render**, and **Vercel**.

## 1. Database: MongoDB Atlas

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) and create an account.
2. Build a Database using the free **M0 cluster**.
3. Under **Database Access**, create a user with a secure password.
4. Under **Network Access**, add `0.0.0.0/0` (Allow Access From Anywhere) so your backend can connect.
5. Click **Connect**, select **Drivers**, and copy the connection string. Replace `<password>` with your database user's password.
6. Save this string; this is your `MONGO_URL`.

## 2. Backend: Render

1. Go to [Render](https://render.com) and create an account.
2. Connect your GitHub account.
3. Click **New +** and select **Blueprint**.
4. Connect the Gylfa repository. Render will read the `render.yaml` file in the root of the project.
5. Render will prompt you for the missing environment variables marked as `sync: false`. You will need to provide:
   - `MONGO_URL`: The string from MongoDB Atlas.
   - `JWT_SECRET`: A long, random string (e.g., generate one with `openssl rand -hex 32`).
   - `FRONTEND_URL`: Leave blank initially, then update this *after* you deploy the frontend (e.g., `https://gylfa.vercel.app`).
   - `CORS_ORIGINS`: Set this to match `FRONTEND_URL`.
   - `ADMIN_EMAIL`: Your admin email.
   - `ADMIN_PASSWORD`: Your admin password.
   - `DEMO_EMAIL`: Demo account email.
   - `DEMO_PASSWORD`: Demo account password.
   - `RESEND_API_KEY`: Your Resend API key (from your `.env`).
6. Once the service deploys, copy the backend URL (e.g., `https://gylfa-backend.onrender.com`).

## 3. Frontend: Vercel

1. Go to [Vercel](https://vercel.com) and log in with GitHub.
2. Click **Add New** -> **Project**.
3. Import the Gylfa repository.
4. In the **Framework Preset**, select `Create React App`.
5. Under **Root Directory**, click **Edit** and select the `frontend` folder.
6. Open **Environment Variables** and add:
   - `REACT_APP_BACKEND_URL`: The URL of your deployed Render backend (e.g., `https://gylfa-backend.onrender.com`).
7. Click **Deploy**.

## 4. Final Wiring

- Go back to your **Render** dashboard for the backend service.
- Update the `FRONTEND_URL` and `CORS_ORIGINS` environment variables to be the exact URL of your deployed Vercel frontend (no trailing slash).
- This ensures the frontend can communicate with the backend securely.
