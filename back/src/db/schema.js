import {
    pgTable, pgEnum, text, uuid,
    timestamp, index, unique,jsonb
} from 'drizzle-orm/pg-core';
import { defineRelations } from 'drizzle-orm';
import { nanoid } from "nanoid";
  
// --- Enums ---
export const accountStatusEnum = pgEnum('account_status', [
    'active',
    'inactive',
    'archived',
    'suspended',
]);

export const usersStatusEnum = pgEnum('users_status', [
    'active',
    'inactive',
    'pending',
    'banned',
]);

export const accountRoleEnum = pgEnum('account_role', [
    'owner',
    'admin',
    'member',
    'viewer',
]);

export const workspaceRoleEnum = pgEnum('workspace_role', [
    'owner',
    'admin',
    'member',
    'viewer',
]);

// --- Tables ---
export const accountsTable = pgTable(
    'accounts',
    {
        id: text().primaryKey().$defaultFn(() => nanoid(25)),
        name: text().default('Default Account').notNull(),
        status: accountStatusEnum('status').default('inactive').notNull(),
        createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().$onUpdate(() => new Date()).notNull(),
    },
    (table) => [
        index('accounts_name_idx').on(table.name),
        index('accounts_status_idx').on(table.status),
    ]
);

export const usersTable = pgTable(
    'users',
    {
        id: text().primaryKey().$defaultFn(() => nanoid(25)),
        status: usersStatusEnum('status').default('pending').notNull(),
        email: text().notNull().unique(),
        firstName: text().default(''),
        lastName: text().default(''),
        password: text(),
        provider: text().default('email'),
        config: jsonb('config').default({}),
        createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().$onUpdate(() => new Date()).notNull(),
    },
    (table) => [
        index('users_email_idx').on(table.email),
        index('users_status_idx').on(table.status),
        index('users_provider_idx').on(table.provider),
        index('users_first_name_idx').on(table.firstName),
        index('users_last_name_idx').on(table.lastName),
    ]
);

export const usersAndAccountsTable = pgTable(
    'users_and_accounts',
    {
        id: text().primaryKey().$defaultFn(() => nanoid(25)),
        role: accountRoleEnum('role').default('admin').notNull(),
        createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().$onUpdate(() => new Date()).notNull(),
        accountId: text().notNull().references(() => accountsTable.id),
        userId: text().notNull().references(() => usersTable.id),
    },
    (table) => [
        unique('users_and_accounts_account_id_user_id_unique').on(
            table.accountId,
            table.userId
        ),
        index('users_and_accounts_account_id_idx').on(table.accountId),
        index('users_and_accounts_user_id_idx').on(table.userId),
        index('users_and_accounts_role_idx').on(table.role),
    ]
);

export const workspacesTable = pgTable(
    'workspaces',
    {
        id: text().primaryKey().$defaultFn(() => nanoid(25)),
        name: text().notNull(),
        createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().$onUpdate(() => new Date()).notNull(),
        accountId: text().references(() => accountsTable.id, {
            onDelete: 'cascade',
        }),
    },
    (table) => [index('workspaces_name_idx').on(table.name)]
);

export const notesTable = pgTable(
    'notes',
    {
        id: text().primaryKey().$defaultFn(() => nanoid(25)),
        title: text().notNull(),
        content: text().notNull(),
        createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().$onUpdate(() => new Date()).notNull(),
        workspaceId: text().notNull().references(() => workspacesTable.id, {
            onDelete: 'cascade',
        }),
        accountId: text().notNull().references(() => accountsTable.id, {
            onDelete: 'cascade',
        }),
    },
    (table) => [index('notes_title_idx').on(table.title)]
);


// --- Relations ---
export const relations = defineRelations(
    {
        accountsTable,
        usersTable,
        usersAndAccountsTable,
        workspacesTable,
        notesTable,
    },
    (r) => ({
        accountsTable: {
            usersAndAccounts: r.many.usersAndAccountsTable({
                from: r.accountsTable.id,
                to: r.usersAndAccountsTable.accountId,
            }),
            workspaces: r.many.workspacesTable({
                from: r.accountsTable.id,
                to: r.workspacesTable.accountId,
            }),
        },
        usersTable: {
            usersAndAccounts: r.many.usersAndAccountsTable({
                from: r.usersTable.id,
                to: r.usersAndAccountsTable.userId,
            }),
        },
        usersAndAccountsTable: {
            account: r.one.accountsTable({
                from: r.usersAndAccountsTable.accountId,
                to: r.accountsTable.id,
            }),
            user: r.one.usersTable({
                from: r.usersAndAccountsTable.userId,
                to: r.usersTable.id,
            }),
        },
        workspacesTable: {
            account: r.one.accountsTable({
                from: r.workspacesTable.accountId,
                to: r.accountsTable.id,
            }),
            notes: r.many.notesTable({
                from: r.workspacesTable.id,
                to: r.notesTable.workspaceId,
            }),
        },
        notesTable: {
            workspace: r.one.workspacesTable({
                from: r.notesTable.workspaceId,
                to: r.workspacesTable.id,
            }),
        },
    })
);