import React, { useState, Fragment } from 'react';
import { Typography, Tag, Button } from 'antd';
import { DiffOutlined, DownOutlined, RightOutlined } from '@ant-design/icons';
import { diffLines } from 'unidiff';
import './diff-styles.css';

const { Text } = Typography;

interface TextDiffViewerProps {
    oldText: string;
    newText: string;
    title: string;
    oldTitle?: string;
    newTitle?: string;
    collapseUnchanged?: boolean; // 新增：是否折叠未改变的内容，默认为true
}

interface DiffChange {
    type: 'equal' | 'insert' | 'delete';
    value: string;
    lineNumber?: number;
}

interface ProcessedLine {
    oldLineNumber?: number;
    newLineNumber?: number;
    type: 'equal' | 'insert' | 'delete' | 'modify';
    oldContent?: string;
    newContent?: string;
    wordChanges?: {
        old: DiffChange[];
        new: DiffChange[];
    };
}

// 新增：可折叠区域的数据结构
interface CollapsibleSection {
    type: 'lines' | 'collapsed';
    lines?: ProcessedLine[];
    collapsedCount?: number;
    startLineOld?: number;
    endLineOld?: number;
    startLineNew?: number;
    endLineNew?: number;
}

// 单词级别的diff
const getWordDiff = (oldLine: string, newLine: string): { old: DiffChange[], new: DiffChange[] } => {
    // 简单的单词分割，支持中英文
    const tokenizeText = (text: string): string[] => {
        // 使用正则表达式分割中英文、数字、标点符号
        return text.match(/[\u4e00-\u9fa5]|[a-zA-Z]+|\d+|[^\s\u4e00-\u9fa5a-zA-Z\d]+|\s+/g) || [];
    };

    const oldTokens = tokenizeText(oldLine);
    const newTokens = tokenizeText(newLine);

    // 简单的LCS算法找出最长公共子序列
    const lcs = (a: string[], b: string[]): string[] => {
        const dp: number[][] = Array(a.length + 1).fill(null).map(() => Array(b.length + 1).fill(0));
        
        for (let i = 1; i <= a.length; i++) {
            for (let j = 1; j <= b.length; j++) {
                if (a[i - 1] === b[j - 1]) {
                    dp[i][j] = dp[i - 1][j - 1] + 1;
                } else {
                    dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
                }
            }
        }

        const result: string[] = [];
        let i = a.length, j = b.length;
        while (i > 0 && j > 0) {
            if (a[i - 1] === b[j - 1]) {
                result.unshift(a[i - 1]);
                i--; j--;
            } else if (dp[i - 1][j] > dp[i][j - 1]) {
                i--;
            } else {
                j--;
            }
        }
        return result;
    };

    const common = lcs(oldTokens, newTokens);
    
    // 构建diff结果
    const buildDiff = (tokens: string[], isOld: boolean): DiffChange[] => {
        const result: DiffChange[] = [];
        let commonIndex = 0;
        
        for (const token of tokens) {
            if (commonIndex < common.length && token === common[commonIndex]) {
                result.push({ type: 'equal', value: token });
                commonIndex++;
            } else {
                result.push({ type: isOld ? 'delete' : 'insert', value: token });
            }
        }
        
        return result;
    };

    return {
        old: buildDiff(oldTokens, true),
        new: buildDiff(newTokens, false)
    };
};

// 处理文本diff
const processTextDiff = (oldText: string, newText: string): ProcessedLine[] => {
    // 使用unidiff进行行级别的比较
    const diff = diffLines(oldText, newText, { newlineIsToken: false });
    
    const result: ProcessedLine[] = [];
    let oldLineNum = 1;
    let newLineNum = 1;
    
    for (const change of diff) {
        const lines = change.value.split('\n');
        // 去掉最后的空行（split产生的）
        if (lines[lines.length - 1] === '') {
            lines.pop();
        }
        
        if (!change.added && !change.removed) {
            // 相同的行
            for (const line of lines) {
                result.push({
                    oldLineNumber: oldLineNum++,
                    newLineNumber: newLineNum++,
                    type: 'equal',
                    oldContent: line,
                    newContent: line
                });
            }
        } else if (change.removed) {
            // 删除的行
            for (const line of lines) {
                result.push({
                    oldLineNumber: oldLineNum++,
                    type: 'delete',
                    oldContent: line
                });
            }
        } else if (change.added) {
            // 新增的行
            for (const line of lines) {
                result.push({
                    newLineNumber: newLineNum++,
                    type: 'insert',
                    newContent: line
                });
            }
        }
    }
    
    // 合并相邻的删除和新增行为修改行
    const merged: ProcessedLine[] = [];
    let i = 0;
    
    while (i < result.length) {
        const current = result[i];
        
        if (current.type === 'delete' && i + 1 < result.length && result[i + 1].type === 'insert') {
            // 找到连续的删除和新增，尝试配对
            const deleteLines: ProcessedLine[] = [];
            const insertLines: ProcessedLine[] = [];
            
            // 收集连续的删除行
            while (i < result.length && result[i].type === 'delete') {
                deleteLines.push(result[i]);
                i++;
            }
            
            // 收集连续的新增行
            while (i < result.length && result[i].type === 'insert') {
                insertLines.push(result[i]);
                i++;
            }
            
            // 配对删除和新增行
            const maxLen = Math.max(deleteLines.length, insertLines.length);
            for (let j = 0; j < maxLen; j++) {
                const deleteLine = deleteLines[j];
                const insertLine = insertLines[j];
                
                if (deleteLine && insertLine) {
                    // 既有删除又有新增，作为修改行处理
                    const wordChanges = getWordDiff(deleteLine.oldContent || '', insertLine.newContent || '');
                    merged.push({
                        oldLineNumber: deleteLine.oldLineNumber,
                        newLineNumber: insertLine.newLineNumber,
                        type: 'modify',
                        oldContent: deleteLine.oldContent,
                        newContent: insertLine.newContent,
                        wordChanges
                    });
                } else if (deleteLine) {
                    // 只有删除
                    merged.push(deleteLine);
                } else if (insertLine) {
                    // 只有新增
                    merged.push(insertLine);
                }
            }
        } else {
            merged.push(current);
            i++;
        }
    }
    
    return merged;
};

// 渲染单词级别的diff
const renderWordDiff = (changes: DiffChange[]): React.ReactNode => {
    return changes.map((change, index) => {
        if (change.type === 'equal') {
            return <span key={index}>{change.value}</span>;
        } else if (change.type === 'insert') {
            return (
                <span key={index} className="diff-word-insert">
                    {change.value}
                </span>
            );
        } else if (change.type === 'delete') {
            return (
                <span key={index} className="diff-word-delete">
                    {change.value}
                </span>
            );
        }
        return null;
    });
};

// 新增：处理折叠逻辑
const processCollapsibleSections = (lines: ProcessedLine[], collapseUnchanged: boolean): CollapsibleSection[] => {
    if (!collapseUnchanged) {
        return [{ type: 'lines', lines }];
    }

    const sections: CollapsibleSection[] = [];
    let currentSection: ProcessedLine[] = [];
    let consecutiveEqualLines: ProcessedLine[] = [];

    const flushCurrentSection = () => {
        if (currentSection.length > 0) {
            sections.push({ type: 'lines', lines: [...currentSection] });
            currentSection = [];
        }
    };

    const processEqualLines = () => {
        if (consecutiveEqualLines.length > 6) {
            // 保留前3行
            const beforeContext = consecutiveEqualLines.slice(0, 3);
            currentSection.push(...beforeContext);
            
            // 折叠中间部分
            const collapsedLines = consecutiveEqualLines.slice(3, -3);
            if (collapsedLines.length > 0) {
                flushCurrentSection();
                sections.push({
                    type: 'collapsed',
                    collapsedCount: collapsedLines.length,
                    startLineOld: collapsedLines[0].oldLineNumber,
                    endLineOld: collapsedLines[collapsedLines.length - 1].oldLineNumber,
                    startLineNew: collapsedLines[0].newLineNumber,
                    endLineNew: collapsedLines[collapsedLines.length - 1].newLineNumber,
                    lines: collapsedLines
                });
            }
            
            // 保留后3行
            const afterContext = consecutiveEqualLines.slice(-3);
            currentSection.push(...afterContext);
        } else {
            // 不足6行，全部保留
            currentSection.push(...consecutiveEqualLines);
        }
        consecutiveEqualLines = [];
    };

    for (const line of lines) {
        if (line.type === 'equal') {
            consecutiveEqualLines.push(line);
        } else {
            // 遇到非equal行，先处理积累的equal行
            processEqualLines();
            currentSection.push(line);
        }
    }

    // 处理最后的equal行
    processEqualLines();
    flushCurrentSection();

    return sections;
};

const TextDiffViewer: React.FC<TextDiffViewerProps> = ({
    oldText,
    newText,
    title,
    oldTitle = "原版本",
    newTitle = "新版本",
    collapseUnchanged = true
}) => {
    const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());
    
    const processedLines = processTextDiff(oldText, newText);
    const sections = processCollapsibleSections(processedLines, collapseUnchanged);
    
    // 计算变更统计
    const stats = processedLines.reduce(
        (acc, line) => {
            if (line.type === 'insert') acc.additions++;
            else if (line.type === 'delete') acc.deletions++;
            else if (line.type === 'modify') {
                acc.modifications++;
            }
            return acc;
        },
        { additions: 0, deletions: 0, modifications: 0 }
    );
    
    const totalChanges = stats.additions + stats.deletions + stats.modifications;
    
    if (totalChanges === 0) {
        return null; // 没有变化则不显示
    }

    const toggleSection = (sectionIndex: number) => {
        const newExpanded = new Set(expandedSections);
        if (newExpanded.has(sectionIndex)) {
            newExpanded.delete(sectionIndex);
        } else {
            newExpanded.add(sectionIndex);
        }
        setExpandedSections(newExpanded);
    };

    const renderCollapsedSection = (section: CollapsibleSection, sectionIndex: number) => {
        const isExpanded = expandedSections.has(sectionIndex);
        
        if (isExpanded && section.lines) {
            // 展开状态：显示所有行，并在最后添加收起按钮
            return (
                <Fragment key={`expanded-${sectionIndex}`}>
                    {section.lines.map((line, lineIndex) => renderDiffLine(line, `${sectionIndex}-${lineIndex}`))}
                    <div className="diff-expanded-footer" style={{ 
                        display: 'flex',
                        minHeight: '32px',
                        fontSize: '12px',
                        alignItems: 'center'
                    }}>
                        <div style={{ 
                            flex: 1, 
                            padding: '6px 8px',
                            borderRight: '1px solid #e8e8e8',
                            display: 'flex',
                            alignItems: 'center'
                        }}>
                            <Button 
                                type="text" 
                                size="small"
                                icon={<DownOutlined />}
                                onClick={() => toggleSection(sectionIndex)}
                                className="diff-collapse-button"
                                style={{ 
                                    fontSize: '10px', 
                                    height: '20px', 
                                    padding: '0 4px'
                                }}
                            >
                                收起 {section.collapsedCount} 行未更改内容
                            </Button>
                        </div>
                        <div style={{ 
                            flex: 1, 
                            padding: '6px 8px',
                            display: 'flex',
                            alignItems: 'center'
                        }}>
                            <Button 
                                type="text" 
                                size="small"
                                icon={<DownOutlined />}
                                onClick={() => toggleSection(sectionIndex)}
                                className="diff-collapse-button"
                                style={{ 
                                    fontSize: '10px', 
                                    height: '20px', 
                                    padding: '0 4px'
                                }}
                            >
                                收起 {section.collapsedCount} 行未更改内容
                            </Button>
                        </div>
                    </div>
                </Fragment>
            );
        }

        // 折叠状态：显示折叠按钮
        return (
            <div 
                key={`collapsed-${sectionIndex}`}
                className="diff-collapse-section"
                style={{ 
                    display: 'flex',
                    minHeight: '32px',
                    fontSize: '12px',
                    alignItems: 'center'
                }}
            >
                <div style={{ 
                    flex: 1, 
                    padding: '6px 8px',
                    borderRight: '1px solid #e8e8e8',
                    display: 'flex',
                    alignItems: 'center'
                }}>
                    <Button 
                        type="text" 
                        size="small"
                        icon={<RightOutlined />}
                        onClick={() => toggleSection(sectionIndex)}
                        className="diff-collapse-button"
                        style={{ 
                            fontSize: '10px', 
                            height: '20px', 
                            padding: '0 4px'
                        }}
                    >
                        展开 {section.collapsedCount} 行未更改内容
                    </Button>
                    {section.startLineOld && (
                        <Text className="diff-collapse-info">
                            第 {section.startLineOld} - {section.endLineOld} 行
                        </Text>
                    )}
                </div>
                <div style={{ 
                    flex: 1, 
                    padding: '6px 8px',
                    display: 'flex',
                    alignItems: 'center'
                }}>
                    <Button 
                        type="text" 
                        size="small"
                        icon={<RightOutlined />}
                        onClick={() => toggleSection(sectionIndex)}
                        className="diff-collapse-button"
                        style={{ 
                            fontSize: '10px', 
                            height: '20px', 
                            padding: '0 4px'
                        }}
                    >
                        展开 {section.collapsedCount} 行未更改内容
                    </Button>
                    {section.startLineNew && (
                        <Text className="diff-collapse-info">
                            第 {section.startLineNew} - {section.endLineNew} 行
                        </Text>
                    )}
                </div>
            </div>
        );
    };

    const renderDiffLine = (line: ProcessedLine, key: string) => (
        <div 
            key={key}
            style={{ 
                display: 'flex',
                minHeight: '20px',
                fontSize: '12px',
                lineHeight: '20px'
            }}
        >
            {/* 左侧内容 */}
            <div style={{ 
                flex: 1, 
                padding: '2px 8px',
                borderRight: '1px solid #e8e8e8',
                backgroundColor: line.type === 'delete' || line.type === 'modify' ? '#fff2f0' : 
                               line.type === 'insert' ? '#f5f5f5' : 'transparent',
                fontFamily: 'monospace'
            }}>
                {line.oldLineNumber && (
                    <span style={{ 
                        color: '#999', 
                        marginRight: 8,
                        fontSize: '10px',
                        minWidth: '30px',
                        display: 'inline-block'
                    }}>
                        {line.oldLineNumber}
                    </span>
                )}
                {line.type === 'modify' && line.wordChanges ? (
                    <span>{renderWordDiff(line.wordChanges.old)}</span>
                ) : (
                    <span>{line.oldContent || ''}</span>
                )}
            </div>
            
            {/* 右侧内容 */}
            <div style={{ 
                flex: 1, 
                padding: '2px 8px',
                backgroundColor: line.type === 'insert' || line.type === 'modify' ? '#f6ffed' : 
                               line.type === 'delete' ? '#f5f5f5' : 'transparent',
                fontFamily: 'monospace'
            }}>
                {line.newLineNumber && (
                    <span style={{ 
                        color: '#999', 
                        marginRight: 8,
                        fontSize: '10px',
                        minWidth: '30px',
                        display: 'inline-block'
                    }}>
                        {line.newLineNumber}
                    </span>
                )}
                {line.type === 'modify' && line.wordChanges ? (
                    <span>{renderWordDiff(line.wordChanges.new)}</span>
                ) : (
                    <span>{line.newContent || ''}</span>
                )}
            </div>
        </div>
    );
    
    return (
        <div className="diff-container" style={{ marginBottom: 16 }}>
            {/* 标题区域 */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                <DiffOutlined style={{ color: '#1890ff', marginRight: 8 }} />
                <Text strong style={{ fontSize: '13px' }}>{title}</Text>
                <div style={{ marginLeft: 12, display: 'flex', gap: 4 }}>
                    {stats.additions > 0 && (
                        <Tag color="green" style={{ fontSize: '10px', margin: 0 }}>
                            +{stats.additions}
                        </Tag>
                    )}
                    {stats.deletions > 0 && (
                        <Tag color="red" style={{ fontSize: '10px', margin: 0 }}>
                            -{stats.deletions}
                        </Tag>
                    )}
                    {stats.modifications > 0 && (
                        <Tag color="blue" style={{ fontSize: '10px', margin: 0 }}>
                            ~{stats.modifications}
                        </Tag>
                    )}
                </div>
            </div>
            
            {/* 左右对照区域 */}
            <div style={{ 
                border: '1px solid #d9d9d9', 
                borderRadius: '6px', 
                overflow: 'hidden'
            }}>
                {/* 头部 */}
                <div className="diff-header">
                    <div className="diff-header-left" style={{ borderRight: '1px solid #e8e8e8' }}>
                        <Text strong style={{ fontSize: '12px', color: '#666' }}>{oldTitle}</Text>
                    </div>
                    <div className="diff-header-right">
                        <Text strong style={{ fontSize: '12px', color: '#666' }}>{newTitle}</Text>
                    </div>
                </div>
                
                {/* 内容区域 */}
                <div>
                    {sections.map((section, sectionIndex) => {
                        if (section.type === 'collapsed') {
                            return renderCollapsedSection(section, sectionIndex);
                        } else if (section.lines) {
                            return section.lines.map((line, lineIndex) => 
                                renderDiffLine(line, `${sectionIndex}-${lineIndex}`)
                            );
                        }
                        return null;
                    })}
                </div>
            </div>
        </div>
    );
};

export default TextDiffViewer; 