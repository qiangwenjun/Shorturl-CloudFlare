export async function hashPassword(password: string): Promise<string> {
	const encoder = new TextEncoder();
	const passwordBuffer = encoder.encode(password);

	const salt = crypto.getRandomValues(new Uint8Array(16));
	const saltBase64 = btoa(String.fromCharCode(...salt));

	const keyMaterial = await crypto.subtle.importKey(
		"raw",
		passwordBuffer,
		{ name: "PBKDF2" },
		false,
		["deriveBits"]
	);

	const derivedBits = await crypto.subtle.deriveBits(
		{
			name: "PBKDF2",
			salt: salt,
			iterations: 100000,
			hash: "SHA-256"
		},
		keyMaterial,
		256
	);

	const hashArray = new Uint8Array(derivedBits);
	const hashBase64 = btoa(String.fromCharCode(...hashArray));

	return `pbkdf2$100000$${saltBase64}$${hashBase64}`;
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
		const passwordBuffer = encoder.encode(password);

		const keyMaterial = await crypto.subtle.importKey(
			"raw",
			passwordBuffer,
			{ name: "PBKDF2" },
			false,
			["deriveBits"]
		);

		const derivedBits = await crypto.subtle.deriveBits(
			{
				name: "PBKDF2",
				salt: salt,
				iterations,
				hash: "SHA-256"
			},
			keyMaterial,
			256
		);

		const derivedArray = new Uint8Array(derivedBits);
		const derivedBase64 = btoa(String.fromCharCode(...derivedArray));

		return constantTimeCompare(derivedBase64, keyBase64);
	} catch (e) {
		console.error('Password verification error:', e);
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
