import {
    pgTable, pgEnum, text, uuid,
    timestamp, index, unique, jsonb,
    integer,
    numeric,
    boolean
} from 'drizzle-orm/pg-core';
import { defineRelations } from 'drizzle-orm';
import { nanoid } from "nanoid";
import { relations as dbRelations } from '#src/db/relationships.js';

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

const id = () => text().primaryKey().$defaultFn(() => nanoid(25));
const timestamps = {
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().$onUpdate(() => new Date()).notNull(),
};

const workspaceRef = () =>
    text().notNull().references(() => workspacesTable.id, { onDelete: 'cascade' });
const accountRef = () =>
    text().notNull().references(() => accountsTable.id, { onDelete: 'cascade' });
export const memberRoleEnum = pgEnum('member_role', ['owner', 'manager', 'advisor', 'technician']);
export const appointmentStatusEnum = pgEnum('appointment_status', ['scheduled', 'confirmed', 'checked_in', 'completed', 'no_show', 'cancelled']);
export const workOrderStatusEnum = pgEnum('work_order_status', ['estimate', 'approved', 'in_progress', 'waiting_parts', 'ready', 'completed', 'cancelled']);
export const paymentStatusEnum = pgEnum('payment_status', ['unpaid', 'partial', 'paid', 'refunded']);
export const approvalStatusEnum = pgEnum('approval_status', ['pending', 'approved', 'declined']);
export const lineTypeEnum = pgEnum('line_type', ['labor', 'part', 'tire', 'fee', 'sublet']);
export const paymentMethodEnum = pgEnum('payment_method', ['cash', 'card', 'bank_transfer', 'other']);
export const discountTypeEnum = pgEnum('discount_type', ['fixed', 'percentage']);

 

// --- Tables ---
export const accountsTable = pgTable(
    'accounts',
    {
        id: id(),
        name: text().default('Default Account').notNull(),
        country: text(),
        status: accountStatusEnum('status').default('inactive').notNull(),
        ...timestamps,
    },
    (table) => [
        index('accounts_name_idx').on(table.name),
        index('accounts_status_idx').on(table.status),
    ]
);
export const usersTable = pgTable(
    'users',
    {
        id: id(),
        status: usersStatusEnum('status').default('pending').notNull(),
        email: text().notNull().unique(),
        firstName: text().default(''),
        lastName: text().default(''),
        password: text(),
        provider: text().default('email'),
        config: jsonb('config').default({}),
        ...timestamps,
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
        id: id(),
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
        id: id(),
        name: text().notNull(),
        ...timestamps,
        accountId: text().references(() => accountsTable.id, {
            onDelete: 'cascade',
        }),
    },
    (table) => [index('workspaces_name_idx').on(table.name)]
);
export const notesTable = pgTable(
    'notes',
    {
        id: id(),
        title: text().notNull(),
        content: text().notNull(),
        ...timestamps,
        workspaceId: text().notNull().references(() => workspacesTable.id, {
            onDelete: 'cascade',
        }),
        accountId: text().notNull().references(() => accountsTable.id, {
            onDelete: 'cascade',
        }),
    },
    (table) => [index('notes_title_idx').on(table.title)]
);



export const locationsTable = pgTable(
    'locations',
    {
        id: id(),
        name: text().notNull(),
        country: text(),
        state: text(),
        city: text(),
        address: text(),
        phone: text(),
        timezone: text().notNull().default('UTC'),
        nextWorkOrderNumber: integer().notNull().default(1),
        accountId: accountRef(),
        workspaceId: workspaceRef(),
        ...timestamps,
    },
    (table) => [index('locations_workspace_idx').on(table.workspaceId)]
);
export const customersTable = pgTable(
    'customers',
    {
        id: id(),
        firstName: text().notNull(),
        lastName: text(),
        companyName: text(),
        email: text().unique(),
        phone: text().unique(),
        address: text(),
        notes: text(),
        accountId: accountRef(),
        workspaceId: workspaceRef(),
        ...timestamps,
    },
    (table) => [
        index('customers_workspace_idx').on(table.workspaceId),
        index('customers_phone_idx').on(table.workspaceId, table.phone),
        index('customers_email_idx').on(table.workspaceId, table.email),
    ]
);
export const vehiclesTable = pgTable(
    'vehicles',
    {
        id: id(),
        vin: text(),
        licensePlate: text(),
        year: integer(),
        make: text(),
        model: text(),
        trim: text(),
        engine: text(),
        color: text(),
        odometer: integer(),
        notes: text(),
        customerId: text().notNull().references(() => customersTable.id, { onDelete: 'cascade' }),
        accountId: accountRef(),
        workspaceId: workspaceRef(),
        ...timestamps,
    },
    (table) => [
        index('vehicles_customer_idx').on(table.customerId),
        index('vehicles_vin_idx').on(table.workspaceId, table.vin),
        index('vehicles_plate_idx').on(table.workspaceId, table.licensePlate),
    ]
);
export const servicesTable = pgTable(
    'services',
    {
        id: id(),
        name: text().notNull(),
        description: text(),
        category: text(),
        price: numeric({ precision: 10, scale: 2, mode: 'number' }).notNull().default(0),
        defaultLaborHours: numeric({ precision: 6, scale: 2, mode: 'number' }),
        defaultPriceCents: integer().notNull().default(0),
        isActive: boolean().notNull().default(true),
        accountId: accountRef(),
        workspaceId: workspaceRef(),
        ...timestamps,
    },
    (table) => [index('services_workspace_idx').on(table.workspaceId, table.category)]
);
export const ordersTable = pgTable(
    'orders',
    {
        id: id(),
        orderNumber: integer().notNull(),
        name: text().notNull(),
        customerNotes: text(),
        internalNotes: text(),
        startDate: timestamp('start_date', { mode: 'date' }),
        dueDate: timestamp('due_date', { mode: 'date' }),
        paymentTerms: text(),
        paymentStatus: text(),
        tax: numeric({ precision: 10, scale: 2, mode: 'number' }).notNull().default(0),
        discount: numeric({ precision: 10, scale: 2, mode: 'number' }).notNull().default(0),
        discountType: discountTypeEnum('discount_type').default('fixed').notNull(),
        totalPrice: numeric({ precision: 10, scale: 2, mode: 'number' }).notNull().default(0),

        status: workOrderStatusEnum('status').default('estimate').notNull(),
        totalAmount: numeric({ precision: 10, scale: 2, mode: 'number' }).notNull().default(0),
        totalTax: numeric({ precision: 10, scale: 2, mode: 'number' }).notNull().default(0),
        totalDiscount: numeric({ precision: 10, scale: 2, mode: 'number' }).notNull().default(0),

        accountId: accountRef(),
        workspaceId: workspaceRef(),
        customerId: text().references(() => customersTable.id, { onDelete: 'restrict' }),
        vehicleId: text().references(() => vehiclesTable.id, { onDelete: 'restrict' }),
        locationId: text().notNull().references(() => locationsTable.id),
        ...timestamps,
    },
    (table) => [
        unique('orders_location_number_unique').on(table.locationId, table.orderNumber),
        index('orders_customer_idx').on(table.customerId),
        index('orders_vehicle_idx').on(table.vehicleId),
        index('orders_status_idx').on(table.status),
        index('orders_workspace_idx').on(table.workspaceId),
    ]
);
export const partsTable = pgTable('parts', {
    id: id(),
    sku: text().notNull(),
    name: text().notNull(),
    brand: text(),
    costCents: integer().notNull().default(0),
    priceCents: integer().notNull().default(0),
    stockQty: integer().notNull().default(0),
    accountId: accountRef(),
    workspaceId: workspaceRef(),
    ...timestamps,
}, (t) => [unique('parts_ws_sku_unique').on(t.workspaceId, t.sku)]);
// junktion tables for odrers
export const ordersServicesTable = pgTable('orders_services', {
    id: id(),
    orderId: text().notNull().references(() => ordersTable.id, { onDelete: 'cascade' }),
    serviceId: text().notNull().references(() => servicesTable.id, { onDelete: 'cascade' }),
    ...timestamps,
}, (t) => [
    unique('orders_services_order_service_unique').on(t.orderId, t.serviceId),
    index('orders_services_order_idx').on(t.orderId),
    index('orders_services_service_idx').on(t.serviceId),
]);
export const ordersPartsTable = pgTable('orders_parts', {
    id: id(),
    orderId: text().notNull().references(() => ordersTable.id, { onDelete: 'cascade' }),
    partId: text().notNull().references(() => partsTable.id, { onDelete: 'cascade' }),
    quantity: integer().notNull().default(1),
    ...timestamps,
}, (t) => [
    unique('orders_parts_order_part_unique').on(t.orderId, t.partId),
    index('orders_parts_order_idx').on(t.orderId),
    index('orders_parts_part_idx').on(t.partId),
]);


// --- Relations ---
export const relations = defineRelations(
    {
        accountsTable,
        usersTable,
        usersAndAccountsTable,
        workspacesTable,
        notesTable,
        locationsTable,
        customersTable,
        vehiclesTable,
        servicesTable,
        partsTable,
        ordersTable,
        ordersServicesTable,
        ordersPartsTable,
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
            // locations: r.many.locationsTable({
            //     from: r.workspacesTable.id,
            //     to: r.locationsTable.workspaceId,
            // }),
            // customers: r.many.customersTable({
            //     from: r.workspacesTable.id,
            //     to: r.customersTable.workspaceId,
            // }),
            // vehicles: r.many.vehiclesTable({
            //     from: r.workspacesTable.id,
            //     to: r.vehiclesTable.workspaceId,
            // }),
            // services: r.many.servicesTable({
            //     from: r.workspacesTable.id,
            //     to: r.servicesTable.workspaceId,
            // }),
            // parts: r.many.partsTable({
            //     from: r.workspacesTable.id,
            //     to: r.partsTable.workspaceId,
            // }),
            // orders: r.many.ordersTable({
            //     from: r.workspacesTable.id,
            //     to: r.ordersTable.workspaceId,
            // }),
        },
        notesTable: {
            workspace: r.one.workspacesTable({
                from: r.notesTable.workspaceId,
                to: r.workspacesTable.id,
            }),
            account: r.one.accountsTable({
                from: r.notesTable.accountId,
                to: r.accountsTable.id,
            }),
        },
        locationsTable: {
            workspace: r.one.workspacesTable({
                from: r.locationsTable.workspaceId,
                to: r.workspacesTable.id,
            }),
            account: r.one.accountsTable({
                from: r.locationsTable.accountId,
                to: r.accountsTable.id,
            }),
            orders: r.many.ordersTable({
                from: r.locationsTable.id,
                to: r.ordersTable.locationId,
            }),
        },
        customersTable: {
            workspace: r.one.workspacesTable({
                from: r.customersTable.workspaceId,
                to: r.workspacesTable.id,
            }),
            account: r.one.accountsTable({
                from: r.customersTable.accountId,
                to: r.accountsTable.id,
            }),
            vehicles: r.many.vehiclesTable({
                from: r.customersTable.id,
                to: r.vehiclesTable.customerId,
            }),
            orders: r.many.ordersTable({
                from: r.customersTable.id,
                to: r.ordersTable.customerId,
            }),
        },
        vehiclesTable: {
            customer: r.one.customersTable({
                from: r.vehiclesTable.customerId,
                to: r.customersTable.id,
            }),
            workspace: r.one.workspacesTable({
                from: r.vehiclesTable.workspaceId,
                to: r.workspacesTable.id,
            }),
            account: r.one.accountsTable({
                from: r.vehiclesTable.accountId,
                to: r.accountsTable.id,
            }),
            orders: r.many.ordersTable({
                from: r.vehiclesTable.id,
                to: r.ordersTable.vehicleId,
            }),
        },
        servicesTable: {
            workspace: r.one.workspacesTable({
                from: r.servicesTable.workspaceId,
                to: r.workspacesTable.id,
            }),
            account: r.one.accountsTable({
                from: r.servicesTable.accountId,
                to: r.accountsTable.id,
            }),
            orders: r.many.ordersTable({
                from: r.servicesTable.id.through(r.ordersServicesTable.serviceId),
                to: r.ordersTable.id.through(r.ordersServicesTable.orderId),
            }),
        },
        partsTable: {
            workspace: r.one.workspacesTable({
                from: r.partsTable.workspaceId,
                to: r.workspacesTable.id,
            }),
            account: r.one.accountsTable({
                from: r.partsTable.accountId,
                to: r.accountsTable.id,
            }),
            orders: r.many.ordersTable({
                from: r.partsTable.id.through(r.ordersPartsTable.partId),
                to: r.ordersTable.id.through(r.ordersPartsTable.orderId),
            }),
        },
        ordersTable: {
            workspace: r.one.workspacesTable({
                from: r.ordersTable.workspaceId,
                to: r.workspacesTable.id,
            }),
            account: r.one.accountsTable({
                from: r.ordersTable.accountId,
                to: r.accountsTable.id,
            }),
            location: r.one.locationsTable({
                from: r.ordersTable.locationId,
                to: r.locationsTable.id,
            }),
            customer: r.one.customersTable({
                from: r.ordersTable.customerId,
                to: r.customersTable.id,
            }),
            vehicle: r.one.vehiclesTable({
                from: r.ordersTable.vehicleId,
                to: r.vehiclesTable.id,
            }),
            // many to many, straight to the other table
            services: r.many.servicesTable({
                from: r.ordersTable.id.through(r.ordersServicesTable.orderId),
                to: r.servicesTable.id.through(r.ordersServicesTable.serviceId),
            }),
            parts: r.many.partsTable({
                from: r.ordersTable.id.through(r.ordersPartsTable.orderId),
                to: r.partsTable.id.through(r.ordersPartsTable.partId),
            }),
            // junction rows, use these when you need quantity
            orderServices: r.many.ordersServicesTable({
                from: r.ordersTable.id,
                to: r.ordersServicesTable.orderId,
            }),
            orderParts: r.many.ordersPartsTable({
                from: r.ordersTable.id,
                to: r.ordersPartsTable.orderId,
            }),
        },
        ordersServicesTable: {
            order: r.one.ordersTable({
                from: r.ordersServicesTable.orderId,
                to: r.ordersTable.id,
            }),
            service: r.one.servicesTable({
                from: r.ordersServicesTable.serviceId,
                to: r.servicesTable.id,
            }),
        },
        ordersPartsTable: {
            order: r.one.ordersTable({
                from: r.ordersPartsTable.orderId,
                to: r.ordersTable.id,
            }),
            part: r.one.partsTable({
                from: r.ordersPartsTable.partId,
                to: r.partsTable.id,
            }),
        },
    })
);


 