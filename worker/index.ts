import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { Context } from "hono";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { cors } from "hono/cors";
import * as jose from "jose";
// import { Resend } from "resend";
import * as v from "valibot";
import type { ApiAuthSuccess, ApiErrorInfo, ApiFailResponse, ApiResponseData, ApiSuccessResponse, ApiVoid, CodeType, User } from "../type/types";
import { auth_tokens, errorInfoMap, loginAuthSchema, loginRequestSchema, userSchema, users } from "../type/types";

type Bindings = {
    DB: D1Database;
    AI: Ai;
    RESENDN_API_KEY: string;
    SECRET_KEY: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use("*", cors());

// ========================================
// ユーティリティ関数
// ========================================

function successResponse(data: ApiResponseData, status = 200): Response {
    const response: ApiSuccessResponse = {
        status: "success",
        data,
    };
    return new Response(JSON.stringify(response), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

function dbUserToUser(dbUser: typeof users.$inferSelect): User {
    return {
        meta: {
            id: dbUser.id,
            version: dbUser.version,
            createdAt: dbUser.created_at,
            updatedAt: dbUser.updated_at,
        },
        data: {
            email: dbUser.email,
            timezone: dbUser.timezone,
        },
    };
}

function userToDbUser(user: User): typeof users.$inferInsert {
    return {
        id: user.meta.id,
        email: user.data.email,
        timezone: user.data.timezone,
        version: user.meta.version,
        created_at: user.meta.createdAt,
        updated_at: user.meta.updatedAt,
    };
}

const jwtPayloadSchema = v.object({
    userId: v.string(),
});

async function auth(c: Context<{ Bindings: Bindings }>): Promise<string | Response> {
    const jwt = getCookie(c, "stellagarden_jwt");
    if (!jwt) {
        return createErrorResponse("no-cookie");
    }

    const secret = new TextEncoder().encode(c.env.SECRET_KEY);
    const { payload } = await jose.jwtVerify(jwt, secret);
    const parseResult = v.safeParse(jwtPayloadSchema, payload);
    if (!parseResult.success) {
        return createErrorResponse("malformed-jwt-payload");
    }
    const userId = parseResult.output.userId;

    return userId;
}

async function setJwtCookie(c: Context<{ Bindings: Bindings }>, userId: string): Promise<void> {
    const secret = new TextEncoder().encode(c.env.SECRET_KEY);
    const alg = "HS256";
    const jwt = await new jose.SignJWT({ userId }).setProtectedHeader({ alg }).setIssuedAt().setExpirationTime("30d").sign(secret);

    setCookie(c, "stellagarden_jwt", jwt, { httpOnly: true, secure: true, sameSite: "Lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
}

function deleteJwtCookie(c: Context<{ Bindings: Bindings }>): void {
    deleteCookie(c, "stellagarden_jwt", { httpOnly: true, secure: true, sameSite: "Lax", path: "/" });
}

type Handler = (c: Context<{ Bindings: Bindings }>) => Promise<Response>;

function withTryCatch(fn: Handler): Handler {
    return async (c) => {
        try {
            return fn(c);
        } catch (error: unknown) {
            let details = "";
            if (error instanceof Error) {
                details = error.stack || error.message;
            }
            return createErrorResponse("unknown-internal-error", details);
        }
    };
}

function createErrorResponse(code: CodeType, details?: string, input?: string): Response {
    const errorInfo = errorInfoMap[code];
    const error_info: ApiErrorInfo = {
        code,
        message: errorInfo[2],
    };
    if (details) {
        error_info.details = details;
    }
    if (input) {
        error_info.input = input;
    }
    const status = errorInfo[1];

    const response: ApiFailResponse = {
        status: "fail",
        error_info,
    };
    return new Response(JSON.stringify(response), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

// ========================================
// API-007: ユーザー設定取得
// ========================================
app.get(
    "/api/v1/user",
    withTryCatch(async (c) => {
        const userId = await auth(c);
        if (userId instanceof Response) {
            return userId;
        }

        const db = drizzle(c.env.DB);
        const result = await db.select().from(users).where(eq(users.id, userId));

        if (result.length === 0) {
            return createErrorResponse("user-not-found");
        }

        if (result.length > 1) {
            return createErrorResponse("user-duplicated");
        }

        const response = dbUserToUser(result[0]);

        return successResponse(response);
    }),
);

// ========================================
// API-008: ユーザー設定更新
// ========================================
app.put(
    "/api/v1/user",
    withTryCatch(async (c) => {
        const userId = await auth(c);
        if (userId instanceof Response) {
            return userId;
        }

        const requestBody = await c.req.json();

        // バリデーション
        const parseResult = v.safeParse(userSchema, requestBody);
        if (!parseResult.success) {
            const details = parseResult.issues.map((issue) => issue.message).join("; ");
            const input = JSON.stringify(requestBody);
            return createErrorResponse("parse-error", details, input);
        }

        if (parseResult.output.meta.id !== userId) {
            return createErrorResponse("invalid-user-id", undefined, `${parseResult.output.meta.id}|${userId}`);
        }

        const updateData = parseResult.output;

        const db = drizzle(c.env.DB);

        // 既存タスクの取得
        const existingTask = await db.select().from(users).where(eq(users.id, userId));

        if (existingTask.length === 0) {
            return createErrorResponse("user-not-found");
        }

        if (existingTask.length > 1) {
            return createErrorResponse("user-duplicated");
        }

        // 楽観的ロックのチェック
        const force = c.req.query("force") === "true";
        if (!force && existingTask[0].version + 1 !== updateData.meta.version) {
            return createErrorResponse("version-conflict", undefined, `${existingTask[0].version}|${updateData.meta.version}`);
        }

        await db.update(users).set(userToDbUser(updateData)).where(eq(users.id, userId));

        const response: ApiVoid = {
            type: "void",
        };

        return successResponse(response);
    }),
);

// ========================================
// API-009: magic link送信
// ========================================
app.post(
    "/api/v1/login",
    withTryCatch(async (c) => {
        const requestBody = await c.req.json();

        // バリデーション
        const parseResult = v.safeParse(loginRequestSchema, requestBody);
        if (!parseResult.success) {
            const details = parseResult.issues.map((issue) => issue.message).join("; ");
            const input = JSON.stringify(requestBody);
            return createErrorResponse("parse-error", details, input);
        }

        console.log("Magic link requested for email:", parseResult.output.email);
        const token = new Uint8Array(32);
        crypto.getRandomValues(token);
        const tokenString = Array.from(token)
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
        console.log(`Magic Link: http://localhost:5173/login/auth?token=${tokenString}`);
        /*
        const resend = new Resend(c.env.RESENDN_API_KEY);

        const { data } = await resend.emails.send({
            from: 'stellagarden <stellagarden@lulliecat.com>',
            to: [parseResult.output.email],
            subject: 'login link to stellagarden',
            text: 'Click here to login: https://stellagarden.lulliecat.com/login/magic-link?token=YOUR-TOKEN',
        });
        console.log("Magic link email sent:", data);
        */

        const createData = parseResult.output;

        const db = drizzle(c.env.DB);

        await db.insert(auth_tokens).values({
            token: tokenString,
            email: createData.email,
            created_at: new Date().toISOString(),
        });

        const response: ApiVoid = {
            type: "void",
        };

        return successResponse(response);
    }),
);

// ========================================
// API-010: 認証トークン検証
// ========================================
app.post(
    "/api/v1/auth",
    withTryCatch(async (c) => {
        const requestBody = await c.req.json();

        // バリデーション
        const parseResult = v.safeParse(loginAuthSchema, requestBody);
        if (!parseResult.success) {
            const details = parseResult.issues.map((issue) => issue.message).join("; ");
            const input = JSON.stringify(requestBody);
            return createErrorResponse("parse-error", details, input);
        }

        const authData = parseResult.output;

        const db = drizzle(c.env.DB);
        const sent_token = await db.select().from(auth_tokens).where(eq(auth_tokens.token, authData.token));

        if (sent_token.length !== 1) {
            return createErrorResponse("auth-id-not-found");
        }

        // トークン使用後は削除
        await db.delete(auth_tokens).where(eq(auth_tokens.token, authData.token));

        const user = await db.select().from(users).where(eq(users.email, sent_token[0].email));

        if (user.length === 0) {
            const id = crypto.randomUUID();
            // ユーザーが存在しない場合、新規作成
            const new_user: typeof users.$inferInsert = {
                id,
                email: sent_token[0].email,
                timezone: 9,
                version: 1,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            await db.insert(users).values(new_user);

            const response: ApiAuthSuccess = {
                type: "auth-success",
                userId: id,
            };

            await setJwtCookie(c, id);
            return successResponse(response);
        }

        if (user.length > 1) {
            return createErrorResponse("user-duplicated");
        }

        const response: ApiAuthSuccess = {
            type: "auth-success",
            userId: user[0].id,
        };

        await setJwtCookie(c, user[0].id);
        return successResponse(response);
    }),
);

// ========================================
// API-011: ログアウト
// ========================================
app.post(
    "/api/v1/logout",
    withTryCatch(async (c) => {
        deleteJwtCookie(c);

        const response: ApiVoid = {
            type: "void",
        };

        return successResponse(response);
    }),
);

export default app;
