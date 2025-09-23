import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import 'highlight.js/styles/github.css';

interface MarkdownMessageProps {
  content: string;
  className?: string;
}

const MarkdownMessage: React.FC<MarkdownMessageProps> = ({ content, className = '' }) => {
  return (
    <div className={`markdown-content ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight, rehypeRaw]}
        components={{
          // Custom styling for different markdown elements
          h1: ({ children }: any) => (
            <h1 className="text-xl font-bold mb-3 text-gray-900 border-b border-gray-200 pb-2">
              {children}
            </h1>
          ),
          h2: ({ children }: any) => (
            <h2 className="text-lg font-semibold mb-2 text-gray-900">
              {children}
            </h2>
          ),
          h3: ({ children }: any) => (
            <h3 className="text-base font-medium mb-2 text-gray-900">
              {children}
            </h3>
          ),
          p: ({ children }: any) => (
            <p className="mb-3 leading-relaxed">
              {children}
            </p>
          ),
          ul: ({ children }: any) => (
            <ul className="list-disc list-inside mb-3 space-y-1 ml-4">
              {children}
            </ul>
          ),
          ol: ({ children }: any) => (
            <ol className="list-decimal list-inside mb-3 space-y-1 ml-4">
              {children}
            </ol>
          ),
          li: ({ children }: any) => (
            <li className="leading-relaxed">
              {children}
            </li>
          ),
          blockquote: ({ children }: any) => (
            <blockquote className="border-l-4 border-gray-300 pl-4 italic mb-3 text-gray-700 bg-gray-50 py-2">
              {children}
            </blockquote>
          ),
          code: ({ inline, className, children, ...props }: any) => {
            const match = /language-(\w+)/.exec(className || '');
            return !inline && match ? (
              <div className="mb-3">
                <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto text-sm">
                  <code className={className} {...props}>
                    {children}
                  </code>
                </pre>
              </div>
            ) : (
              <code className="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
                {children}
              </code>
            );
          },
          pre: ({ children }: any) => (
            <div className="mb-3">
              {children}
            </div>
          ),
          table: ({ children }: any) => (
            <div className="overflow-x-auto mb-3">
              <table className="min-w-full border border-gray-300 rounded-lg">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }: any) => (
            <thead className="bg-gray-50">
              {children}
            </thead>
          ),
          tbody: ({ children }: any) => (
            <tbody className="divide-y divide-gray-200">
              {children}
            </tbody>
          ),
          th: ({ children }: any) => (
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase border-b border-gray-300">
              {children}
            </th>
          ),
          td: ({ children }: any) => (
            <td className="px-4 py-2 text-sm text-gray-900 border-b border-gray-200">
              {children}
            </td>
          ),
          a: ({ children, href }: any) => (
            <a
              href={href}
              className="text-blue-600 hover:text-blue-800 underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),
          strong: ({ children }: any) => (
            <strong className="font-semibold text-gray-900">
              {children}
            </strong>
          ),
          em: ({ children }: any) => (
            <em className="italic">
              {children}
            </em>
          ),
          hr: () => (
            <hr className="border-t border-gray-300 my-4" />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownMessage;