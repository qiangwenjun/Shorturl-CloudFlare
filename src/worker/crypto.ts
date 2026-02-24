export async function hashPassword(password: string): Promise<string> {
	const encoder = new TextEncoder();
	const keyMaterial = await crypto.subtle.importKey(
		"raw",
		encoder.encode(password),
		{ name: "PBKDF2" },
		false,
		["deriveKey"]
	);

	const salt = crypto.getRandomValues(new Uint8Array(16));
	const saltBase64 = btoa(String.fromCharCode(...salt));

	const key = await crypto.subtle.deriveKey(
		{
			name: "PBKDF2",
			salt: salt,
			iterations: 100000,
			hash: "SHA-256"
		},
		keyMaterial,
		{ name: "AES-GCM", length: 256 },
		true,
		["encrypt", "decrypt"]
	);

	const exportedKey = await crypto.subtle.exportKey("raw", key);
	const keyArray = new Uint8Array(exportedKey as ArrayBuffer);
	const keyBase64 = btoa(String.fromCharCode(...keyArray));

	return `pbkdf2$100000$${saltBase64}$${keyBase64}`;
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
	try {
		const parts = hash.split("$");
		if (parts.length !== 4 || parts[0] !== "pbkdf2") {
			return false;
		}

		const iterations = parseInt(parts[1], 10);
		const saltBase64 = parts[2];
		const keyBase64 = parts[3];

		const salt = Uint8Array.from(atob(saltBase64), c => c.charCodeAt(0));

		const encoder = new TextEncoder();
		const keyMaterial = await crypto.subtle.importKey(
			"raw",
			encoder.encode(password),
			{ name: "PBKDF2" },
			false,
			["deriveKey"]
		);

		const key = await crypto.subtle.deriveKey(
			{
				name: "PBKDF2",
				salt: salt,
				iterations,
				hash: "SHA-256"
			},
			keyMaterial,
			{ name: "AES-GCM", length: 256 },
			true,
			["encrypt", "decrypt"]
		);

		const exportedKey = await crypto.subtle.exportKey("raw", key);
		const exportedKeyArray = new Uint8Array(exportedKey as ArrayBuffer);
		const exportedKeyBase64 = btoa(String.fromCharCode(...exportedKeyArray));

		return constantTimeCompare(exportedKeyBase64, keyBase64);
	} catch {
		return false;
	}
}

function constantTimeCompare(a: string, b: string): boolean {
	if (a.length !== b.length) {
		return false;
	}

	let result = 0;
	for (let i = 0; i < a.length; i++) {
		result |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}

	return result === 0;
}
