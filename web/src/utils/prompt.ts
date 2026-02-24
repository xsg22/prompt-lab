// 提示词调用相关工具函数
import { AIFeaturesAPI } from '@/lib/api';
import { type TestCase } from '@/types/prompt';

interface Message {
    role: string;
    content: string;
    order: number;
}

interface GeneratedTestCases {
    normal: TestCase[];
    boundary: TestCase[];
    error: TestCase[];
}

export interface TestCaseCount {
    normal: number;
    boundary: number;
    error: number;
}

// 添加变量约束的类型定义
export interface VariableConstraint {
    variable: string;
    constraint: string;
}

/**
 * 生成测试用例的提示词
 */
export const generateTestPrompt = (
    messages: Message[], 
    variables: string[], 
    counts: TestCaseCount, 
    variableConstraints?: VariableConstraint[],
    customRequirement?: string
): string => {
    // 分析提示词内容，构建生成测试用例的提示
    // 按order排序并生成完整的提示词模板
    const sortedMessages = messages.sort((a, b) => a.order - b.order);
    const promptTemplate = sortedMessages.map(message => 
        `[${message.role} message 的内容]:\n ${message.content}`
    ).join('\n');
    
    // 为每个类别生成示例
    const generateExamples = (type: string, count: number) => {
        if (count === 0) return '';
        const examples = [];
        for (let i = 1; i <= count; i++) {
            examples.push(`    {${variables.map(v => `"${v}": "${type}值示例${i}"`).join(', ')}}`);
        }
        return examples.join(',\n\n');
    };

    // 构建变量约束部分
    const variableConstraintsSection = variableConstraints && variableConstraints.length > 0 
        ? `**变量约束要求：**
${variableConstraints.map(constraint => 
    `- ${constraint.variable}: ${constraint.constraint}`
).join('\n')}

`
        : '';

    // 构建自定义要求部分
    const customRequirementSection = customRequirement?.trim() 
        ? `**总体要求：** ${customRequirement.trim()}\n\n`
        : '';

    return `请分析以下提示词模板，为其生成高质量的测试用例。

**提示词模板：**
${promptTemplate}

**变量列表：** ${variables.join(', ')}

${variableConstraintsSection}${customRequirementSection}**生成要求：**
1. 分析提示词的功能和应用场景
2. 为每个变量生成多种测试值，包括：
   - 正常情况：符合预期的常规输入
   - 边界情况：极值、边界条件、特殊格式
   - 异常情况：可能导致意外输出的输入
3. 生成具体的内容，不要使用占位符、描述符，禁止输出：random text等描述性内容
4. 请严格按照指定数量生成测试用例：
   - 正常情况：${counts.normal}个
   - 边界情况：${counts.boundary}个
   - 异常情况：${counts.error}个
5. ${variableConstraints && variableConstraints.length > 0 ? '严格遵守上述变量约束要求' : ''}${customRequirement?.trim() ? `严格遵守总体要求` : ''}

**输出格式：**
请严格按照以下JSON格式返回，不要添加任何其他文字：
{
  "analysis": "提示词功能分析",${counts.normal > 0 ? `
  "normal": [
${generateExamples('正常', counts.normal)}
  ],` : ''}${counts.boundary > 0 ? `
  "boundary": [
${generateExamples('边界', counts.boundary)}
  ],` : ''}${counts.error > 0 ? `
  "error": [
${generateExamples('异常', counts.error)}
  ]` : ''}
}`;
};

/**
 * 解析生成的测试用例数据
 */
export const parseGeneratedTestCases = (content: string, variables: string[]): GeneratedTestCases => {
    // 解析生成的JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
        throw new Error('生成的内容格式不正确');
    }

    const generatedData = JSON.parse(jsonMatch[0]);
    
    // 转换为TestCase格式
    const convertToTestCases = (cases: any[], type: 'normal' | 'boundary' | 'error'): TestCase[] => {
        const generatedAt = new Date().toISOString();
        return (cases || []).map((testCase, _) => {
            const result: TestCase = {};
            variables.forEach(variable => {
                result[variable] = testCase[variable] || '';
            });
            // 添加元数据
            result.metadatas = {
                source: 'ai_generated',
                type: type,
                generatedAt: generatedAt
            };
            return result;
        });
    };

    return {
        normal: convertToTestCases(generatedData.normal || [], 'normal'),
        boundary: convertToTestCases(generatedData.boundary || [], 'boundary'),
        error: convertToTestCases(generatedData.error || [], 'error')
    };
};

/**
 * 调用AI生成测试用例
 */
export const callAIGenerateTestCases = async (
    messages: Message[], 
    variables: string[], 
    projectId: number,
    counts: TestCaseCount = { normal: 3, boundary: 2, error: 2 },
    variableConstraints?: VariableConstraint[],
    customRequirement?: string,
    promptId?: number,
    promptVersionId?: number,
): Promise<GeneratedTestCases> => {
    const prompt = generateTestPrompt(messages, variables, counts, variableConstraints, customRequirement);

    const response = await AIFeaturesAPI.callFeature(projectId, {
        feature_key: 'test_case_generator',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 4000,
        prompt_id: promptId,
        prompt_version_id: promptVersionId,
    });

    return parseGeneratedTestCases(response.data.message, variables);
};
