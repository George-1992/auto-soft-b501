'use client';
import Turnstile, { useTurnstile } from "react-turnstile";

export default function TurnstileEl({ onVerify }) {
    const CF_TURNSTILE_SITE_KEY = import.meta.env.VITE_CF_TURNSTILE_SITE_KEY;

    return (
        <Turnstile
            sitekey={CF_TURNSTILE_SITE_KEY}
            onVerify={(token) => {
                if (onVerify) {
                    onVerify(token)
                }
            }}
        />
    )
}