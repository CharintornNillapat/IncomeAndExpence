// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, resolve } from 'path';
import ts from 'typescript';
import { render, cleanup, screen } from '@testing-library/react';
import { Modal } from '../src/components/Modal';

/**
 * Phase 110 (ADR 0086, audit finding 16): every dialog is named by its own
 * heading, through `aria-labelledby`, so a screen reader announces what
 * opened. `Modal` links the heading it draws from `title`, and a custom
 * `header` through `titleId`. The second half reads every `<Modal>` in `src/`
 * and fails on one given neither, which is how a new dialog would go unnamed.
 */

afterEach(() => cleanup());

const noop = () => {};

describe('Modal names itself by its heading', () => {
  it('with a title, by the heading it draws', () => {
    render(
      <Modal isOpen onClose={noop} title="Add debt">
        <p>body</p>
      </Modal>,
    );
    const dialog = screen.getByRole('dialog');
    const heading = document.getElementById(dialog.getAttribute('aria-labelledby')!)!;
    expect(heading.textContent).toBe('Add debt');
    expect(screen.getByRole('dialog', { name: 'Add debt' })).toBe(dialog);
  });

  it('with a custom header, by the element its titleId names', () => {
    render(
      <Modal
        isOpen
        onClose={noop}
        titleId="custom-title"
        header={
          <div>
            <h3 id="custom-title">Sign in</h3>
            <button type="button" onClick={noop}>Close</button>
          </div>
        }
      >
        <p>body</p>
      </Modal>,
    );
    expect(screen.getByRole('dialog').getAttribute('aria-labelledby')).toBe('custom-title');
    expect(screen.getByRole('dialog', { name: 'Sign in' })).toBeTruthy();
  });
});

const SRC = resolve(__dirname, '../src');

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return tsxFiles(path);
    return path.endsWith('.tsx') ? [path] : [];
  });
}

/** Every `<Modal ...>` in `src/`, with the props it is given, by file and line. */
function modalUses(): Array<{ where: string; props: string[] }> {
  const uses: Array<{ where: string; props: string[] }> = [];
  for (const file of tsxFiles(SRC)) {
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const visit = (node: ts.Node) => {
      if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(source) === 'Modal') {
        const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
        uses.push({
          where: `${relative(SRC, file).replace(/\\/g, '/')}:${line + 1}`,
          props: node.attributes.properties.flatMap((p) => (ts.isJsxAttribute(p) ? [p.name.getText(source)] : [])),
        });
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return uses;
}

describe('every dialog in the app', () => {
  it('passes Modal a title, or a titleId for its own header', () => {
    const uses = modalUses();
    // The count guards the scan itself: a parse that finds nothing passes vacuously.
    expect(uses.length).toBeGreaterThanOrEqual(14);
    const unnamed = uses.filter(({ props }) => !props.includes('title') && !props.includes('titleId')).map(({ where }) => where);
    expect(unnamed).toEqual([]);
  });
});
