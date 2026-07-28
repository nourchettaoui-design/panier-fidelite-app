// Composant réutilisable pour champ mot de passe avec "œil" pour afficher/cacher
import React, { type JSX } from 'react';

type Props = {
    value: string;
    onChange: (v: string) => void;
    name?: string;
    placeholder?: string;
    id?: string;
    className?: string;
    required?: boolean;
    ariaLabel?: string;
    autoComplete?: string;
};

export default function PasswordInput(props: Props): JSX.Element {
    const { value, onChange, name, placeholder, id, className, required, ariaLabel , autoComplete} = props;
    const [visible, setVisible] = React.useState<boolean>(false);

    function toggle() {
        setVisible(v => !v);
    }

    return (
        <div className={`password-input ${className || ''}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
                id={id}
                name={name}
                type={visible ? 'text' : 'password'}
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                required={required}
                style={{ flex: 1, paddingRight: 38 }}
                aria-label={ariaLabel || 'Mot de passe'}
                autoComplete={autoComplete ?? 'current-password'}
            />
            <button
                type="button"
                onClick={toggle}
                aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                title={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                className="password-toggle-btn"
                style={{
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    padding: 6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}
            >
                {visible ? (
                    // Eye-off / fermé
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M10.58 10.58a3 3 0 0 0 4.24 4.24" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M2.91 12a16 16 0 0 1 3.43-4.03A13.37 13.37 0 0 1 12 6c2.08 0 4.05.43 5.66 1.17" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                ) : (
                    // Eye open
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                        <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                )}
            </button>
        </div>
    );
}
