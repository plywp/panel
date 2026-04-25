import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "../src/lib/server/db/schema";
import { admin, organization } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

async function main() {
    const args = process.argv.slice(2);

    if (args.includes("--help") || args.includes("-h")) {
        console.log("Usage:");
        console.log("  Interactive: bun add-user");
        console.log("  Non-interactive: bun add-user <email> <password> <name> [role] [orgName]");
        process.exit(0);
    }

    let email = args[0];
    let password = args[1];
    let name = args[2];
    let role = args[3] || "user";
    let orgNameArg = args[4];

    // Interactive mode if arguments are missing
    if (!email || !password || !name) {
        console.log("Interactive Mode: Please provide user details.");
        email = email || prompt("Email: ") || "";
        password = password || prompt("Password: ") || "";
        name = name || prompt("Name: ") || "";
        role = role === "user" ? (prompt("Role (user/admin) [user]: ") || "user") : role;
        orgNameArg = orgNameArg || prompt("Organization Name (leave empty to skip): ") || "";

        if (!email || !password || !name) {
            console.error("Error: Email, password, and name are required.");
            process.exit(1);
        }
    }

    const { DATABASE_USER, DATABASE_PASSWORD, DATABASE_HOST, DATABASE_PORT, DATABASE_NAME } = process.env;

    if (!DATABASE_USER || !DATABASE_NAME) {
        console.error("Missing database environment variables.");
        process.exit(1);
    }

    console.log(`Connecting to database ${DATABASE_NAME} on ${DATABASE_HOST}...`);

    const connection = await mysql.createConnection({
        host: DATABASE_HOST,
        user: DATABASE_USER,
        password: DATABASE_PASSWORD,
        database: DATABASE_NAME,
        port: Number(DATABASE_PORT) || 3306,
    });

    const db = drizzle(connection, { schema, mode: "default" });

    const auth = betterAuth({
        database: drizzleAdapter(db, {
            provider: "mysql",
        }),
        emailAndPassword: {
            enabled: true,
        },
        user: {
            additionalFields: {
                lang: {
                    type: 'string',
                    required: true,
                    defaultValue: 'en_US',
                    input: true
                }
            }
        },
        plugins: [admin(), organization()],
    });

    console.log(`Creating user ${email}...`);

    try {
        const userResult = await auth.api.signUpEmail({
            body: {
                email,
                password,
                name,
            },
        });

        const userId = userResult.user.id;
        console.log("User created successfully!");

        if (role && role !== "user") {
            console.log(`Setting role to ${role}...`);
            await db.update(schema.user)
                .set({ role })
                .where(eq(schema.user.id, userId));
            console.log(`Role set to ${role}.`);
        }

        // Handle Organization
        const finalOrgName = orgNameArg || (role === "admin" ? "Default Organization" : "");
        
        if (finalOrgName) {
            console.log(`Creating organization "${finalOrgName}"...`);
            const orgId = uuidv4();
            const slug = finalOrgName.toLowerCase().replace(/\s+/g, "-") + "-" + Math.floor(Math.random() * 1000);
            
            await db.insert(schema.organization).values({
                id: orgId,
                name: finalOrgName,
                slug: slug,
                createdAt: new Date(),
            });

            await db.insert(schema.member).values({
                id: uuidv4(),
                organizationId: orgId,
                userId: userId,
                role: "owner",
                createdAt: new Date(),
            });
            console.log(`User added to organization "${finalOrgName}".`);
        }

        console.log("\nSuccess!");
        console.log(`Email: ${email}`);
        console.log(`Role: ${role}`);
        if (finalOrgName) console.log(`Org:  ${finalOrgName}`);
        
    } catch (error: any) {
        console.error("Error creating user:", error.message || error);
    } finally {
        await connection.end();
        process.exit(0);
    }
}

main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});
