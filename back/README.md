<!-- Database, Prisma, Postgres -->
npm install @prisma/client@7
npm install --save-dev prisma@7

npx prisma@prev init --datasource-provider postgresql
npm install @prisma/adapter-pg  optional
<!-- npx prisma@7 db pull --> optional

npx prisma@7 generate

