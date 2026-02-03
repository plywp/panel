import { eq } from 'drizzle-orm';
import { db } from './index';
import { keyStore } from './schema/key-value-pair';
export async function setValue(key: string, value: string): Promise<void> {
	await db.insert(keyStore).values({ key, value }).onDuplicateKeyUpdate({ set: { value } });
}

export async function getValue(key: string): Promise<string | undefined> {
	const [row] = await db
		.select({ value: keyStore.value })
		.from(keyStore)
		.where(eq(keyStore.key, key))
		.limit(1);

	return row?.value;
}

export async function deleteValue(key: string): Promise<void> {
	await db.delete(keyStore).where(eq(keyStore.key, key));
}
