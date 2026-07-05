import { Button } from '@astryxdesign/core/Button'
import { Badge } from '@astryxdesign/core/Badge'
import { Banner } from '@astryxdesign/core/Banner'
import { Token } from '@astryxdesign/core/Token'
import { Card } from '@astryxdesign/core/Card'
import { VStack, HStack } from '@astryxdesign/core/Stack'
import { Heading, Text } from '@astryxdesign/core/Text'
import { TextInput } from '@astryxdesign/core/TextInput'
import { Switch } from '@astryxdesign/core/Switch'
import { Divider } from '@astryxdesign/core/Divider'
import { Theme } from '@astryxdesign/core/theme'
import { useState, useMemo } from 'react'
import { createTheme } from './theme'
import { SCHEMES, paletteToThemeInput, detectMode } from './mapper'

function themeToCode(key: string): string {
  const s = SCHEMES[key];
  const mode = detectMode(s.palette, s.variant);
  const { accent, neutralStyle, tokens } = paletteToThemeInput(s.palette, mode);

  // Show all tokens from the mapper
  const tokenLines = Object.entries(tokens)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => {
      return Array.isArray(v)
        ? `    '${k}': ['${v[0]}', '${v[1]}'],`
        : `    '${k}': '${v}',`;
    });

  return [
    "import { defineTheme } from '@astryxdesign/core/theme';",
    "import { neutralTheme } from '@astryxdesign/theme-neutral';",
    '',
    `export const ${key.replace(/-/g, '')}Theme = defineTheme({`,
    `  name: '${s.name}',`,
    '',
    '  extends: neutralTheme,',
    '',
    '  color: {',
    `    accent: '${accent}',`,
    `    neutralStyle: '${neutralStyle}',`,
    '  },',
    '',
    '  tokens: {',
    ...tokenLines,
    '  },',
    '});',
    '',
    '/*',
    ' * Fixes needed alongside defineTheme (Astryx v0.1.3):',
    ' *',
    ' * 1. Force color-scheme so light-dark() resolves correctly.',
    ' *    @layer astryx-theme injects :root { color-scheme: light dark }',
    ' *    which beats the reset layer. Unlayered rules fix this.',
    ' *',
    ' * 2. Destructive button text — StyleX cascade drops',
    ' *    --color-on-error from reaching inner text spans.',
    ' */',
    "/*",
    "html[data-theme='dark']  { color-scheme: dark; }",
    "html[data-theme='light'] { color-scheme: light; }",
    '',
    "[data-variant='destructive'].astryx-button,",
    "[data-variant='destructive'].astryx-button span {",
    '  color: var(--color-on-error) !important;',
    '}',
    '*/',
  ].join('\n');
}

function App() {
  const [schemeKey, setSchemeKey] = useState('one-dark')
  const [switched, setSwitched] = useState(false)
  const { theme, mode } = useMemo(() => {
    const s = SCHEMES[schemeKey];
    return { theme: createTheme(s.palette, s.name, s.variant), mode: s.variant! };
  }, [schemeKey]);
  const themeCode = useMemo(() => themeToCode(schemeKey), [schemeKey]);

  return (
    <Theme theme={theme} mode={mode}>
      <VStack gap={4} style={{ maxWidth: 720, margin: '48px auto', padding: '0 24px' }}>
        <Heading level={1}>Astryx + base24 Theme POC</Heading>
        <Text>Extending the Neutral theme with base24 color schemes.</Text>

        <Divider />

        <Heading level={2}>Scheme</Heading>

        <Heading level={4}>Dark</Heading>
        <HStack gap={2} wrap="wrap">
          {Object.entries(SCHEMES)
            .filter(([, s]) => s.variant === 'dark')
            .map(([key, s]) => (
              <Button
                key={key}
                label={s.name}
                variant={key === schemeKey ? 'primary' : 'secondary'}
                onClick={() => setSchemeKey(key)}
              />
            ))}
        </HStack>

        <Heading level={4}>Light</Heading>
        <HStack gap={2} wrap="wrap">
          {Object.entries(SCHEMES)
            .filter(([, s]) => s.variant === 'light')
            .map(([key, s]) => (
              <Button
                key={key}
                label={s.name}
                variant={key === schemeKey ? 'primary' : 'secondary'}
                onClick={() => setSchemeKey(key)}
              />
            ))}
        </HStack>

        <Heading level={4}>defineTheme()</Heading>
        <Card>
          <pre style={{ margin: 0, fontSize: '0.75rem', lineHeight: 1.55, overflow: 'auto', maxHeight: 340 }}>
            <code>{themeCode}</code>
          </pre>
        </Card>

        <Divider />

        <Heading level={2}>Buttons</Heading>
        <HStack gap={2} wrap="wrap">
          <Button label="Primary" variant="primary" />
          <Button label="Secondary" variant="secondary" />
          <Button label="Destructive" variant="destructive" />
          <Button label="Ghost" variant="ghost" />
        </HStack>

        <Heading level={2}>Badges</Heading>

        <Heading level={4}>Semantic</Heading>
        <HStack gap={2} wrap="wrap">
          <Badge label="Neutral" />
          <Badge label="Info" variant="info" />
          <Badge label="Success" variant="success" />
          <Badge label="Warning" variant="warning" />
          <Badge label="Error" variant="error" />
        </HStack>

        <Heading level={4}>Color</Heading>
        <HStack gap={2} wrap="wrap">
          <Badge label="Blue" variant="blue" />
          <Badge label="Cyan" variant="cyan" />
          <Badge label="Green" variant="green" />
          <Badge label="Orange" variant="orange" />
          <Badge label="Pink" variant="pink" />
          <Badge label="Purple" variant="purple" />
          <Badge label="Red" variant="red" />
          <Badge label="Teal" variant="teal" />
          <Badge label="Yellow" variant="yellow" />
        </HStack>

        <Heading level={2}>Banners</Heading>
        <VStack gap={2}>
          <Banner status="info" title="Information" description="This is an info banner." />
          <Banner status="success" title="Success" description="Operation completed successfully." />
          <Banner status="warning" title="Warning" description="Proceed with caution." />
          <Banner status="error" title="Error" description="Something went wrong." />
        </VStack>

        <Heading level={2}>Tokens</Heading>
        <HStack gap={2} wrap="wrap">
          <Token label="Default" />
          <Token label="Blue" color="blue" />
          <Token label="Cyan" color="cyan" />
          <Token label="Green" color="green" />
          <Token label="Orange" color="orange" />
          <Token label="Pink" color="pink" />
          <Token label="Purple" color="purple" />
          <Token label="Red" color="red" />
          <Token label="Teal" color="teal" />
          <Token label="Yellow" color="yellow" />
          <Token label="Gray" color="gray" />
        </HStack>

        <Heading level={2}>Card</Heading>
        <Card>
          <VStack gap={2}>
            <Heading level={3}>Card Title</Heading>
            <Text>Cards pick up the theme's background, border, and text colors.</Text>
          </VStack>
        </Card>

        <Heading level={2}>Form Elements</Heading>
        <VStack gap={2}>
          <TextInput label="Demo input" value="" placeholder="Type something..." />
          <HStack gap={2} align="center">
            <Switch label="Toggle" value={switched} onChange={() => setSwitched(!switched)} />
            <Text>Toggle: {switched ? 'ON' : 'OFF'}</Text>
          </HStack>
        </VStack>
      </VStack>
    </Theme>
  )
}

export default App
