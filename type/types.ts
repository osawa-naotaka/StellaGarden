// =============================================================================
// StellaGarden - Type Definitions
// =============================================================================

import * as v from "valibot";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// -----------------------------------------------------------------------------
// 基本型
// -----------------------------------------------------------------------------


// -----------------------------------------------------------------------------
// リザルト・エラー型
// -----------------------------------------------------------------------------

export type ResultStatus = "success" | ResultErrorStatus;
export type ResultErrorStatus = "abort" | "recoverable" | "conflict" | "login-required" | "fatal";

export type Result<T> = ResultSuccess<T> | ResultFail<T>;

export type ResultSuccess<T> = {
    status: "success";
    data: T;
}

export type ResultFail<T> = {
    status: ResultErrorStatus;
    error_info: ApiErrorInfo;
    data?: T;
}

export type Void = Record<never, never>;

export type OnComplete<T> = (r: Result<T>) => void;
export type OnError = OnComplete<Void>;


export type CodeType = keyof typeof errorInfoMap;
export type StatusType = ResultErrorStatus;
export type HttpStatusType = number;
export type MessageType = string;

export type ErrorInfo = [StatusType, HttpStatusType, MessageType];

export const errorInfoMap = {
    "parse-error": ["fatal", 400, "リクエストボディが正しくパースできませんでした。"],
    "no-cookie": ["login-required", 401, "認証情報が存在しません。ログインしてください。"],
    "invalid-token": ["login-required", 401, "認証情報が無効です。再度ログインしてください。"],
    "auth-id-not-found": ["login-required", 401, "ログイントークンがDBに存在しません。"],
    "auth-id-expired": ["login-required", 401, "ログイントークンの有効期限が切れています。"],
    "version-conflict": ["conflict", 409, "versionフィールドの不一致が検出されました。"],
    "db-binding-not-found": ["fatal", 500, "データベースバインディングが設定されていません。"],
    "no-secret-key": ["fatal", 500, "JWT用の秘密鍵が設定されていません。"],
    "user-duplicated": ["fatal", 500, "DB内に同一のユーザーIDのレコードが複数存在します。"],
    "user-not-found": ["fatal", 500, "DB内に指定されたユーザーIDのレコードが存在しません。"],
    "malformed-jwt-payload": ["fatal", 500, "JWTのペイロードが正しくパースできませんでした。"],
    "invalid-user-id": ["fatal", 500, "JWTペイロード内のユーザーIDが、リクエストボディのユーザーIDと一致しません。"],
    "unknown-internal-error": ["fatal", 500, "不明な内部エラーが発生しました。"],
} as const;

// DB層関連型
// -----------------------------------------------------------------------------

//
// タスクおよび設定共通関連型
//

export const idSchema = v.pipe(v.string(), v.uuid()); // タスクID（UUIDv4、永続化層で生成）
export const dateSchema = v.pipe(v.string(), v.isoTimestamp());
export const versionSchema = v.pipe(v.number(), v.toMinValue(0)); // 楽観的ロック用バージョン番号

export const ContainerMetaSchema = v.object({
    id: idSchema,
    version: versionSchema, // 楽観的ロック用バージョン番号(永続化層で生成、DB層で検証)
    createdAt: dateSchema, // 作成日時 (永続化層で生成)
    updatedAt: dateSchema, // 更新日時（永続化層で生成）
});

export const ContainerSchema = <T>(dataSchema: Schema<T>) => v.object({
    meta: ContainerMetaSchema,
    data: dataSchema,
});

export type Container<T> = {
    meta: v.InferOutput<typeof ContainerMetaSchema>;
    data: T;
};


// -----------------------------------------------------------------------------
// ユーザー設定型
// -----------------------------------------------------------------------------

// ユーザー設定（サーバー → クライアント）
export const userContentSchema = v.object({
    timezone: v.number(),
    email: v.pipe(v.string(), v.email()),
});

export const userSchema = v.object({
    meta: ContainerMetaSchema,
    data: userContentSchema,
});

export type User = v.InferOutput<typeof userSchema>;
export type UserContent = v.InferOutput<typeof userContentSchema>;

export const usersSchema = v.array(userSchema);

export type Users = v.InferOutput<typeof usersSchema>;

// -----------------------------------------------------------------------------
// 認証関連型
// -----------------------------------------------------------------------------

export const loginRequestSchema = v.object({
    email: v.pipe(v.string(), v.email()),
});

export type LoginRequest = v.InferOutput<typeof loginRequestSchema>;

export const loginAuthSchema = v.object({
    token: v.string(),
});

export type LoginAuth = v.InferOutput<typeof loginAuthSchema>;

// -----------------------------------------------------------------------------
// ネットワーク層関連型
// -----------------------------------------------------------------------------

export abstract class IFetch {
    abstract getJson(path: string): Promise<Response>;
    abstract postJson(path: string, body: object): Promise<Response>;
    abstract putJson(path: string, body: object): Promise<Response>;
}

//
// APIレスポンス関連型
//

// 共通レスポンス型
export type ApiResponse = ApiSuccessResponse | ApiFailResponse;

// 成功レスポンス
export const apiSuccessResponseSchema = v.object({
    status: v.picklist(["success"]),
    data: v.unknown(),
});

export type ApiSuccessResponse = v.InferOutput<typeof apiSuccessResponseSchema>;

export const apiErrorInfoSchema = v.object({
    code: v.string(), // エラーコード
    message: v.string(), // エラーメッセージ（日本語）
    details: v.optional(v.string()), // stack traceなど
    input: v.optional(v.string()), // 入力データ（任意）
});

// 失敗レスポンス
export const apiFailResponseSchema = v.object({
    status: v.picklist(["fail"]),
    error_info: apiErrorInfoSchema,
    data: v.optional(v.unknown()),
});

export type ApiErrorInfo = v.InferOutput<typeof apiErrorInfoSchema>;
export type ApiFailResponse = v.InferOutput<typeof apiFailResponseSchema>;


// API呼び出し成功時のレスポンスボディ型
export type ApiResponseData = ApiVoid | ApiUser | ApiAuthSuccess;

export const apiVoidSchema = v.object({
    type: v.picklist(["void"]),
});

export type ApiVoid = v.InferOutput<typeof apiVoidSchema>;

// ユーザー設定のレスポンスボディ
export const apiUserSchema = userSchema;
export type ApiUser = v.InferOutput<typeof apiUserSchema>;

// 認証成功のレスポンスボディ
export const apiAuthSuccessSchema = v.object({
    type: v.picklist(["auth-success"]),
    userId: idSchema,
});

export type ApiAuthSuccess = v.InferOutput<typeof apiAuthSuccessSchema>;

// -----------------------------------------------------------------------------
// 永続化層関連型
// -----------------------------------------------------------------------------

export type Schema<T> = v.BaseSchema<unknown, T, v.BaseIssue<unknown>>;

export type ConnectResult<S> = {
    user: Container<S>;
};


export abstract class IPersistent<T, S> {
    abstract get user(): Container<S>;
    abstract get isLogin(): boolean;
    abstract get userId(): string;
    abstract registerOnError(onError: OnError): void;
    abstract requestLogin(email: string): void;
    abstract connect(token: string, onComplete: OnComplete<ConnectResult<S>>): void;
    abstract disconnect(onComplete: OnComplete<ConnectResult<S>>): void;
    abstract create(item: Container<T>): void;
    abstract update(item: Container<T>): void;
    abstract updateSetting(value: Container<S>): void;
}

// ========================================
// Database Schema関連の型
// ========================================

export const users = sqliteTable("users", {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    timezone: integer("timezone").notNull(),
    version: integer("version").notNull(),
    created_at: text("created_at").notNull(),
    updated_at: text("updated_at").notNull(),
});

export const auth_tokens = sqliteTable("auth_tokens", {
    token: text("token").primaryKey(),
    email: text("email").notNull(),
    created_at: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
});
