import { DragEvent, useMemo } from "react";

import type { BlockAssignmentConfig, BlockNode, BlockType } from "../app/blockProgramming";
import {
  createBlock,
  createStarterProgram,
  generatePythonFromBlocks,
  getBlockDefinition,
  getPaletteForConfig,
} from "../app/blockProgramming";

interface BlockEditorProps {
  config: BlockAssignmentConfig;
  value: BlockNode[];
  onChange: (blocks: BlockNode[]) => void;
}

function categoryLabel(category: "output" | "variables" | "logic" | "loops" | "notes"): string {
  if (category === "output") return "Вывод";
  if (category === "variables") return "Переменные";
  if (category === "logic") return "Логика";
  if (category === "loops") return "Циклы";
  return "Заметки";
}

type BlockNodeView = {
  block: BlockNode;
  index: number;
  children: BlockNodeView[];
};

export function BlockEditor({ config, value, onChange }: BlockEditorProps) {
  const palette = useMemo(() => getPaletteForConfig(config), [config]);
  const generatedCode = useMemo(() => generatePythonFromBlocks(value), [value]);
  const blockTree = useMemo(() => {
    const root: BlockNodeView = { block: createBlock("comment"), index: -1, children: [] };
    root.block.indent = -1;
    const stack: BlockNodeView[] = [root];

    value.forEach((block, index) => {
      while (stack.length > 1 && stack[stack.length - 1].block.indent >= block.indent) {
        stack.pop();
      }
      const node: BlockNodeView = { block, index, children: [] };
      stack[stack.length - 1].children.push(node);
      stack.push(node);
    });

    return root.children;
  }, [value]);

  function getSubtreeRange(startIndex: number) {
    const baseIndent = value[startIndex]?.indent ?? 0;
    let endIndex = startIndex + 1;
    while (endIndex < value.length && value[endIndex].indent > baseIndent) {
      endIndex += 1;
    }
    return { startIndex, endIndex, baseIndent };
  }

  function moveSubtree(blockId: string, targetIndex: number, indentDelta = 0) {
    const sourceIndex = value.findIndex((block) => block.id === blockId);
    if (sourceIndex === -1) return;

    const { startIndex, endIndex } = getSubtreeRange(sourceIndex);
    if (targetIndex >= startIndex && targetIndex <= endIndex) return;

    const subtree = value.slice(startIndex, endIndex).map((block) => ({
      ...block,
      indent: Math.max(0, block.indent + indentDelta),
    }));
    const remainder = [...value.slice(0, startIndex), ...value.slice(endIndex)];
    const adjustedTarget = targetIndex > startIndex ? targetIndex - (endIndex - startIndex) : targetIndex;
    const clampedTarget = Math.max(0, Math.min(remainder.length, adjustedTarget));
    const nextBlocks = [
      ...remainder.slice(0, clampedTarget),
      ...subtree,
      ...remainder.slice(clampedTarget),
    ];
    onChange(nextBlocks);
  }

  function insertBlock(type: BlockType, index: number) {
    const previousBlock = index > 0 ? value[index - 1] : null;
    // Keep sibling level by default; nesting should happen only via explicit "insert inside" dropzones.
    const indent = previousBlock?.indent ?? 0;
    const nextBlocks = [...value];
    nextBlocks.splice(index, 0, createBlock(type, { indent }));
    onChange(nextBlocks);
  }

  function moveExistingBlock(blockId: string, index: number) {
    moveSubtree(blockId, index);
  }

  function updateField(blockId: string, key: string, nextValue: string) {
    onChange(
      value.map((block) =>
        block.id === blockId
          ? {
              ...block,
              params: {
                ...block.params,
                [key]: nextValue,
              },
            }
          : block,
      ),
    );
  }

  function shiftBlock(blockId: string, direction: -1 | 1) {
    const index = value.findIndex((block) => block.id === blockId);
    if (index === -1) return;

    const { startIndex, endIndex } = getSubtreeRange(index);
    if (direction === -1) {
      if (startIndex === 0) return;
      const targetIndex = startIndex - 1;
      moveSubtree(blockId, targetIndex);
      return;
    }

    if (endIndex >= value.length) return;
    const nextSiblingRange = getSubtreeRange(endIndex);
    moveSubtree(blockId, nextSiblingRange.endIndex);
  }

  function adjustIndent(blockId: string, delta: -1 | 1) {
    const index = value.findIndex((block) => block.id === blockId);
    if (index === -1) return;

    const { startIndex, endIndex, baseIndent } = getSubtreeRange(index);
    const nextBaseIndent = Math.max(0, Math.min(6, baseIndent + delta));
    const appliedDelta = nextBaseIndent - baseIndent;
    if (appliedDelta === 0) return;

    const nextBlocks = value.map((block, blockIndex) => {
      if (blockIndex >= startIndex && blockIndex < endIndex) {
        return { ...block, indent: Math.max(0, Math.min(6, block.indent + appliedDelta)) };
      }
      return block;
    });
    onChange(nextBlocks);
  }

  function duplicateBlock(blockId: string) {
    const index = value.findIndex((block) => block.id === blockId);
    if (index === -1) return;

    const { startIndex, endIndex } = getSubtreeRange(index);
    const subtree = value.slice(startIndex, endIndex).map((block) =>
      createBlock(block.type, { indent: block.indent, params: block.params }),
    );
    const nextBlocks = [...value];
    nextBlocks.splice(endIndex, 0, ...subtree);
    onChange(nextBlocks);
  }

  function removeBlock(blockId: string) {
    const index = value.findIndex((block) => block.id === blockId);
    if (index === -1) return;

    const { startIndex, endIndex } = getSubtreeRange(index);
    onChange([...value.slice(0, startIndex), ...value.slice(endIndex)]);
  }

  function resetBlocks() {
    onChange(createStarterProgram(config));
  }

  function onDropAtIndex(index: number, event: DragEvent<HTMLDivElement>) {
    event.preventDefault();

    const templateType = event.dataTransfer.getData("application/x-block-template");
    if (templateType) {
      insertBlock(templateType as BlockType, index);
      return;
    }

    const blockId = event.dataTransfer.getData("application/x-block-id");
    if (blockId) {
      moveExistingBlock(blockId, index);
    }
  }

  function insertIntoBlock(parentIndex: number, type: BlockType) {
    const parent = value[parentIndex];
    if (!parent) return;
    const { endIndex } = getSubtreeRange(parentIndex);
    const indent = parent.indent + 1;
    const nextBlocks = [...value];
    nextBlocks.splice(endIndex, 0, createBlock(type, { indent }));
    onChange(nextBlocks);
  }

  function moveIntoBlock(parentIndex: number, blockId: string) {
    const parent = value[parentIndex];
    if (!parent) return;
    const parentRange = getSubtreeRange(parentIndex);
    const sourceIndex = value.findIndex((block) => block.id === blockId);
    if (sourceIndex === -1) return;

    const sourceRange = getSubtreeRange(sourceIndex);
    if (parentIndex >= sourceRange.startIndex && parentIndex < sourceRange.endIndex) return;

    const indentDelta = parent.indent + 1 - value[sourceIndex].indent;
    moveSubtree(blockId, parentRange.endIndex, indentDelta);
  }

  function onDropIntoBlock(parentIndex: number, event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const templateType = event.dataTransfer.getData("application/x-block-template");
    if (templateType) {
      insertIntoBlock(parentIndex, templateType as BlockType);
      return;
    }

    const blockId = event.dataTransfer.getData("application/x-block-id");
    if (blockId) {
      moveIntoBlock(parentIndex, blockId);
    }
  }

  function renderNodeList(nodes: BlockNodeView[], parentIndex: number | null) {
    const endIndex = parentIndex === null ? value.length : getSubtreeRange(parentIndex).endIndex;

    return (
      <>
        {nodes.map((node) => {
          const definition = getBlockDefinition(node.block.type);
          return (
            <div key={node.block.id}>
              <div
                className="block-dropzone block-dropzone--between"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => onDropAtIndex(node.index, event)}
              >
                Вставить сюда
              </div>

              <article
                className={`workspace-block workspace-block--${definition.category}`}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("application/x-block-id", node.block.id);
                }}
              >
                <div className="workspace-block__head">
                  <div>
                    <strong>{definition.label}</strong>
                    <p className="hint">Уровень вложенности: {node.block.indent}</p>
                  </div>
                  <div className="workspace-block__actions">
                    <button type="button" onClick={() => adjustIndent(node.block.id, -1)}>
                      {"<<"}
                    </button>
                    <button type="button" onClick={() => adjustIndent(node.block.id, 1)}>
                      {">>"}
                    </button>
                    <button type="button" onClick={() => shiftBlock(node.block.id, -1)}>
                      ^
                    </button>
                    <button type="button" onClick={() => shiftBlock(node.block.id, 1)}>
                      v
                    </button>
                    <button type="button" onClick={() => duplicateBlock(node.block.id)}>
                      Дубль
                    </button>
                    <button type="button" onClick={() => removeBlock(node.block.id)}>
                      Удалить
                    </button>
                  </div>
                </div>

                {definition.fields.length > 0 && (
                  <div className="workspace-block__fields">
                    {definition.fields.map((field) => (
                      <label
                        key={field.key}
                        className={field.width === "wide" ? "block-field block-field--wide" : "block-field"}
                      >
                        <span>{field.label}</span>
                        <input
                          value={node.block.params[field.key] ?? ""}
                          onChange={(event) => updateField(node.block.id, field.key, event.target.value)}
                          placeholder={field.placeholder}
                        />
                      </label>
                    ))}
                  </div>
                )}

                {definition.opensScope && (
                  <div className="block-children">
                    <div
                      className="block-dropzone block-dropzone--between"
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => onDropIntoBlock(node.index, event)}
                    >
                      Вставить внутрь
                    </div>
                    {node.children.length > 0 && renderNodeList(node.children, node.index)}
                  </div>
                )}
              </article>
            </div>
          );
        })}

        <div
          className="block-dropzone"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => onDropAtIndex(endIndex, event)}
        >
          Добавить в конец
        </div>
      </>
    );
  }

  return (
    <div className="block-editor">
      <div className="block-editor__layout">
        <section className="block-editor__panel">
          <div className="block-editor__panel-head">
            <h4>Палитра блоков</h4>
            <p className="hint">Клик добавляет блок в конец. Перетаскивание вставляет в нужное место.</p>
          </div>

          {config.goal && <p className="block-editor__goal">{config.goal}</p>}

          {config.hints.length > 0 && (
            <div className="block-editor__tips">
              {config.hints.map((hint) => (
                <p key={hint} className="hint">
                  {hint}
                </p>
              ))}
            </div>
          )}

          <div className="block-palette">
            {palette.map((definition) => (
              <button
                key={definition.type}
                type="button"
                className={`palette-block palette-block--${definition.category}`}
                draggable
                onClick={() => insertBlock(definition.type, value.length)}
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = "copy";
                  event.dataTransfer.setData("application/x-block-template", definition.type);
                }}
              >
                <strong>{definition.label}</strong>
                <span>{categoryLabel(definition.category)}</span>
                <small>{definition.description}</small>
              </button>
            ))}
          </div>
        </section>

        <section className="block-editor__panel">
          <div className="block-editor__panel-head">
            <h4>Рабочая область</h4>
            <div className="chip-row">
              <button type="button" onClick={resetBlocks}>
                Сбросить
              </button>
              <span className="hint">Блоков: {value.length}</span>
            </div>
          </div>

          <div
            className="block-dropzone"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => onDropAtIndex(0, event)}
          >
            Перетащите блок сюда
          </div>

          <div className="block-workspace">
            {value.length === 0 && <p className="empty">Палитра слева готова. Добавьте первый блок.</p>}
            {value.length > 0 && renderNodeList(blockTree, null)}
          </div>
        </section>
      </div>

      <section className="block-editor__panel">
        <div className="block-editor__panel-head">
          <h4>Сгенерированный Python</h4>
          <p className="hint">Этот код отправится вместе со структурой блоков.</p>
        </div>
        <pre className="block-code-preview">{generatedCode}</pre>
      </section>
    </div>
  );
}
