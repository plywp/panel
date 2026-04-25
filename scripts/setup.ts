import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "../src/lib/server/db/schema";
import { admin, organization } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

async function main() {
    console.log("🚀 PlyWP App Setup Script");
    console.log("-------------------------");

    const { DATABASE_USER, DATABASE_PASSWORD, DATABASE_HOST, DATABASE_PORT, DATABASE_NAME } = process.env;

    if (!DATABASE_USER || !DATABASE_NAME) {
        console.error("❌ Missing database environment variables in .env");
        process.exit(1);
    }

    console.log(`📡 Connecting to database ${DATABASE_NAME} on ${DATABASE_HOST}...`);

    const connection = await mysql.createConnection({
        host: DATABASE_HOST,
        user: DATABASE_USER,
        password: DATABASE_PASSWORD,
        database: DATABASE_NAME,
        port: Number(DATABASE_PORT) || 3306,
    });

    const db = drizzle(connection, { schema, mode: "default" });

    // 1. Setup KV Settings
    console.log("📝 Initializing application settings...");
    const settings = [
        { key: "title", value: "PlyWP Panel" },
        { key: "description", value: "Modern WordPress Management Panel" },
        { key: "favicon", value: "/favicon.ico" }
    ];

    for (const { key, value } of settings) {
        await db.insert(schema.keyStore)
            .values({ key, value })
            .onDuplicateKeyUpdate({ set: { value } });
    }
    console.log("✅ Settings initialized.");

    // 2. Setup Auth
    const auth = betterAuth({
        database: drizzleAdapter(db, { provider: "mysql" }),
        emailAndPassword: { enabled: true },
        plugins: [admin(), organization()],
    });

    // 3. Prompt for Admin User
    console.log("\n👤 Create Admin User");
    const email = prompt("Admin Email [admin@example.com]: ") || "admin@example.com";
    const password = prompt("Admin Password: ") || "password123";
    const name = prompt("Admin Name [Admin]: ") || "Admin";

    try {
        console.log(`Creating user ${email}...`);
        const userResult = await auth.api.signUpEmail({
            body: { email, password, name }
        });

        const userId = userResult.user.id;

        // Set Admin Role
        await db.update(schema.user)
            .set({ role: "admin" })
            .where(eq(schema.user.id, userId));
        
        console.log("✅ Admin user created.");

        // 4. Create Organization
        console.log("\n🏢 Create Default Organization");
        const orgName = prompt("Organization Name [Main Org]: ") || "Main Org";
        const orgSlug = orgName.toLowerCase().replace(/\s+/g, "-");

        console.log(`Creating organization ${orgName}...`);
        
        const orgId = uuidv4();
        await db.insert(schema.organization).values({
            id: orgId,
            name: orgName,
            slug: orgSlug,
            createdAt: new Date(),
        });

        // Add user as owner/admin of the organization
        await db.insert(schema.member).values({
            id: uuidv4(),
            organizationId: orgId,
            userId: userId,
            role: "owner",
            createdAt: new Date(),
        });

        console.log("✅ Organization created and user linked.");

        console.log("\n✨ Setup Complete!");
        console.log(`Admin Email: ${email}`);
        console.log(`Organization: ${orgName}`);
        console.log("\nYou can now log in at /sign-in");

    } catch (error: any) {
        console.error("❌ Error during setup:", error.message || error);
    } finally {
        await connection.end();
        process.exit(0);
    }
}

main().catch((err) => {
    console.error("💥 Fatal error:", err);
    process.exit(1);
});
