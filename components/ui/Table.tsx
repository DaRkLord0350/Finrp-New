import React from 'react';

interface TableProps {
    headers: string[];
    rows: (string | number)[][];
}

const Table: React.FC<TableProps> = ({ headers, rows }) => {
    return (
        <div className="overflow-x-auto">
            <table className="min-w-full">
                <thead className="bg-slate-50 dark:bg-slate-700/50">
                    <tr>
                        {headers.map((header, i) => (
                            <th key={i} className="px-4 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">
                                {header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {rows.map((row, i) => (
                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                            {row.map((cell, j) => (
                                <td key={j} className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200 whitespace-nowrap">
                                    {cell}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default Table;
