import { useEffect, useRef, type CSSProperties } from 'react';
import type { Prompt } from '../../shared/types/prompt';
import { resolveIcon } from './prompts.icon';
import { usePrompts } from './prompts.use';
import './prompts.ui.css';

const ACCENT = '#C9B77B';
const MUTED = '#A3A692';
const TEXT = '#E6E4D6';

const emptyTextStyle: CSSProperties = {
  margin: 0,
  padding: '36px 22px',
  fontSize: 16,
  color: MUTED,
};

function ReloadIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 11a8 8 0 1 0-2.3 5.7" />
      <path d="M20 4v7h-7" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke={MUTED}
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

export type PromptsViewProps = {
  title: string;
  count: number;
  query: string;
  onQueryChange: (value: string) => void;
  items: Prompt[];
  activeId: string | null;
  status: string | null;
  emptyMessage: string | null;
  onReload: () => void;
  onChooseFolder: () => void;
  onInject: (prompt: Prompt) => void;
};

export function PromptsView({
  title,
  count,
  query,
  onQueryChange,
  items,
  activeId,
  status,
  emptyMessage,
  onReload,
  onChooseFolder,
  onInject,
}: PromptsViewProps) {
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  return (
    <div
      style={{
        width: 404,
        height: 584,
        boxSizing: 'border-box',
        padding: 12,
        background: '#1D1F18',
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          background: '#262922',
          border: '1px solid #3A3E2F',
          borderRadius: 6,
          color: TEXT,
          fontFamily: "'Gelica', Georgia, serif",
          overflow: 'hidden',
        }}
      >
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 10px 6px 22px',
            background: '#1D1F18',
            borderBottom: '1px solid #353929',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <h1
              style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 400,
                letterSpacing: '0.01em',
                lineHeight: 1.2,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {title}
            </h1>
            <span style={{ fontSize: 12, color: MUTED }}>{count} files</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 2, flex: 'none' }}>
            <button
              type="button"
              className="iconbtn"
              aria-label="Reload files"
              title="Reload files"
              onClick={onReload}
            >
              <ReloadIcon />
            </button>
            <button
              type="button"
              className="iconbtn"
              aria-label="Choose folder"
              title="Choose folder"
              onClick={onChooseFolder}
            >
              <FolderIcon />
            </button>
          </div>
        </header>

        {status ? (
          <p style={{ margin: 0, padding: '0 22px 8px', fontSize: 12, color: '#D4A373' }}>
            {status}
          </p>
        ) : null}

        <div style={{ padding: '14px 22px 6px' }}>
          <label
            className="searchwrap"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              height: 40,
              borderBottom: '1px solid #4A4F3C',
            }}
          >
            <SearchIcon />
            <input
              ref={searchRef}
              className="search"
              type="text"
              aria-label="Search prompts"
              placeholder="Find a prompt"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              style={{
                flex: 1,
                minWidth: 0,
                height: '100%',
                background: 'transparent',
                border: 0,
                color: TEXT,
                fontFamily: "'Gelica', Georgia, serif",
                fontSize: 16,
              }}
            />
          </label>
        </div>

        <div className="list" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {emptyMessage ? (
            <p style={emptyTextStyle}>{emptyMessage}</p>
          ) : (
            items.map((prompt) => {
              const active = activeId === prompt.id;
              const Icon = resolveIcon(prompt.iconName);

              return (
                <button
                  key={prompt.id}
                  type="button"
                  className="row"
                  aria-label={`Inject ${prompt.name}`}
                  onClick={() => onInject(prompt)}
                >
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 22,
                      height: 22,
                      flex: 'none',
                      color: active ? ACCENT : MUTED,
                    }}
                  >
                    <Icon size={22} strokeWidth={1.5} aria-hidden="true" />
                  </span>

                  <span
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 3,
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 17,
                        lineHeight: 1.25,
                        color: active ? ACCENT : TEXT,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {prompt.name}
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        color: MUTED,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {prompt.fileName}
                    </span>
                  </span>

                  {active ? (
                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        flex: 'none',
                        fontSize: 12,
                        color: ACCENT,
                      }}
                    >
                      <CheckIcon />
                      Injected
                    </span>
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export function PromptsPopup() {
  const view = usePrompts();
  return <PromptsView {...view} />;
}
