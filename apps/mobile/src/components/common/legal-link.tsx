import { StyleProp, Text, TextStyle } from 'react-native';

import { ExternalLink } from '@/components/common/external-link';
import type { LegalLink as LegalLinkInfo } from '@/features/auth';

type LegalLinkProps = { link: LegalLinkInfo; style?: StyleProp<TextStyle>; linkStyle?: StyleProp<TextStyle> };

/**
 * The privacy policy or terms, inline in a sentence: a link once its URL is set in
 * `src/features/auth/legal-links.ts`, plain text until then.
 */
export function LegalLink({ link, style, linkStyle }: LegalLinkProps) {
  if (!link.url) return <Text style={style}>{link.label}</Text>;
  return (
    <ExternalLink href={link.url} accessibilityRole="link" style={[style, linkStyle]}>
      {link.label}
    </ExternalLink>
  );
}
