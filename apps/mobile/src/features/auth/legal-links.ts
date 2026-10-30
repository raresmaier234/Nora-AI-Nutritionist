export type LegalLink = { label: string; url: `https://${string}` | null };

/**
 * The privacy policy and terms, linked from the sign-in screen and the Profile tab's account section. Both app
 * stores require them before release. Until a page has a URL its name shows as plain text —
 * fill in `url` once the pages are published.
 */
export const LEGAL_LINKS: { terms: LegalLink; privacy: LegalLink } = {
  terms: { label: 'Terms of Service', url: null },
  privacy: { label: 'Privacy Policy', url: null },
};
