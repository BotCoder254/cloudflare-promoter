import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"

import * as schema from "../src/shared/db/schema"
import { createDatabaseClient } from "./db"
import type { WorkerEnv } from "./env"

const FALLBACK_SECRET = "golinks-dev-secret-please-change-before-production-123"

const parseAdminEmails = (env: WorkerEnv): Set<string> => {
  return new Set(
    (env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean),
  )
}

const getAvailableSocialProviders = (env: WorkerEnv): Array<"github" | "google"> => {
  const providers: Array<"github" | "google"> = []

  if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) {
    providers.push("github")
  }

  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    providers.push("google")
  }

  return providers
}

export const getAvailableProviderMap = (env: WorkerEnv) => {
  const socialProviders: Record<string, { clientId: string; clientSecret: string }> = {}

  if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) {
    socialProviders.github = {
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
    }
  }

  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    socialProviders.google = {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    }
  }

  return socialProviders
}

export const createAuth = (env: WorkerEnv, request: Request) => {
  const requestOrigin = new URL(request.url).origin
  const baseURL = env.BETTER_AUTH_URL ?? requestOrigin
  const databaseClient = createDatabaseClient(env)
  const adminEmails = parseAdminEmails(env)

  if (!databaseClient) {
    throw new Error("D1 binding 'DB' is required for Better Auth")
  }

  const database = drizzleAdapter(databaseClient, {
    provider: "sqlite",
    schema: {
      user: schema.userTable,
      session: schema.sessionTable,
      account: schema.accountTable,
      verification: schema.verificationTable,
    },
  })

  return betterAuth({
    appName: "golinks",
    baseURL,
    trustedOrigins: [new URL(baseURL).origin, requestOrigin],
    secret: env.BETTER_AUTH_SECRET ?? FALLBACK_SECRET,
    database,
    user: {
      additionalFields: {
        role: {
          type: ["user", "admin"],
          required: false,
          defaultValue: "user",
          input: false,
        },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      sendResetPassword: async ({ user, url }) => {
        console.log(`[golinks] password reset requested for ${user.email}: ${url}`)
      },
    },
    socialProviders: getAvailableProviderMap(env),
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ["credential", "github", "google"],
        allowDifferentEmails: false,
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            const role = adminEmails.has(user.email.toLowerCase()) ? "admin" : "user"
            return {
              data: {
                ...user,
                role,
              },
            }
          },
        },
      },
    },
  })
}

export const listAvailableSocialProviders = (env: WorkerEnv) => getAvailableSocialProviders(env)
