/**
 * No hard-coded user-facing text in app/ and components/: words shown to the munshi must come
 * from the dictionaries (t('…')). Flags letters in JSX text (<Text>Save</Text>), in string /
 * template literals rendered as JSX children, in text props (label, title, placeholder,
 * accessibilityLabel, …) and in Alert.alert(). Numbers, symbols and emoji are fine.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';

const ROOT = join(__dirname, '..');

/** Props whose value is shown or read out to the user. */
const TEXT_PROPS = new Set(['label', 'title', 'subtitle', 'body', 'placeholder', 'accessibilityLabel', 'accessibilityHint', 'confirmLabel']);

/** Words allowed as they are in every language (currency, units, abbreviations). */
const ALLOWED = new Set(['Rs', 'kg', 'OTP', 'PDF']);

const LETTERS = /[A-Za-z؀-ۿ]/;
const hasWords = (text: string) => text.split(/[^A-Za-z؀-ۿ]+/).some((w) => w && !ALLOWED.has(w) && LETTERS.test(w));

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? files(full) : name.endsWith('.tsx') ? [full] : [];
  });
}

/** Literal text inside an expression that ends up on screen: strings, template parts, both sides of ?: and ??/||. */
function literalTexts(node: ts.Node): string[] {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return [node.text];
  if (ts.isTemplateExpression(node)) return [node.head.text, ...node.templateSpans.map((s) => s.literal.text)];
  if (ts.isParenthesizedExpression(node)) return literalTexts(node.expression);
  if (ts.isConditionalExpression(node)) return [...literalTexts(node.whenTrue), ...literalTexts(node.whenFalse)];
  if (ts.isBinaryExpression(node) && [ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.PlusToken].includes(node.operatorToken.kind)) {
    return [...literalTexts(node.left), ...literalTexts(node.right)];
  }
  return [];
}

function scan(file: string, text = readFileSync(file, 'utf8')): string[] {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: string[] = [];
  const report = (node: ts.Node, text: string) => {
    if (!hasWords(text)) return;
    const { line } = source.getLineAndCharacterOfPosition(node.getStart());
    found.push(`${relative(ROOT, file).replace(/\\/g, '/')}:${line + 1} "${text.trim()}"`);
  };
  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node)) report(node, node.text);
    else if (ts.isJsxExpression(node) && node.expression && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))) {
      for (const text of literalTexts(node.expression)) report(node, text);
    } else if (ts.isJsxAttribute(node) && TEXT_PROPS.has(node.name.getText(source)) && node.initializer) {
      const init = node.initializer;
      if (ts.isStringLiteral(init)) report(node, init.text);
      else if (ts.isJsxExpression(init) && init.expression) for (const text of literalTexts(init.expression)) report(node, text);
    } else if (ts.isCallExpression(node) && node.expression.getText(source) === 'Alert.alert') {
      for (const arg of node.arguments) for (const text of literalTexts(arg)) report(node, text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

describe('no hard-coded user-facing text', () => {
  const all = [...files(join(ROOT, 'app')), ...files(join(ROOT, 'components'))];

  it('scans the screens and components', () => {
    expect(all.length).toBeGreaterThan(30);
  });

  it('every visible word in app/ and components/ comes from the dictionaries', () => {
    expect(all.flatMap((file) => scan(file))).toEqual([]);
  });

  it('the scanner catches literal text (self-check)', () => {
    const probe = 'export const A = () => (<><Text>Save now</Text><Text>{ok ? "Yes" : t("x")}</Text><B label="Back" title={`OT ${h}h`} placeholder="0" /><Text>{n} · {"Rs"}</Text></>);\nAlert.alert("Oops");\n';
    expect(scan(join(ROOT, 'probe.tsx'), probe).map((s) => s.replace(/^.*?:\d+ /, ''))).toEqual(['"Save now"', '"Yes"', '"Back"', '"OT"', '"h"', '"Oops"']);
  });
});
