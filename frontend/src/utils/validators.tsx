import { z } from 'zod';

export const signupSchema = z.object({
    email: z.string().min(1, 'Email requis').email('Email invalide'),
    mot_de_passe: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
});
