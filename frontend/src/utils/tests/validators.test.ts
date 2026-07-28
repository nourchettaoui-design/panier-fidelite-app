import { describe, it, expect } from 'vitest';
import { signupSchema } from '../validators';

describe('signupSchema', () => {
    it('rejects invalid email', () => {
        const result = signupSchema.safeParse({ email: 'not-an-email', mot_de_passe: 'password123' });
        expect(result.success).toBe(false);
    });

    it('rejects short password', () => {
        const result = signupSchema.safeParse({ email: 'user@example.com', mot_de_passe: 'short' });
        expect(result.success).toBe(false);
    });

    it('accepts valid input', () => {
        const result = signupSchema.safeParse({ email: 'user@example.com', mot_de_passe: 'password123' });
        expect(result.success).toBe(true);
    });
});
