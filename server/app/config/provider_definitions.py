"""
模型提供商定义配置

定义所有支持的模型提供商及其配置信息和默认模型
"""

from typing import Dict, List, Any

from app.schemas.model import DefaultModel, ProviderDefinition, ProviderField


# 提供商字段类型定义
FIELD_TYPES = {
    "string": {"type": "string", "component": "Input"},
    "password": {"type": "string", "component": "Input.Password"},
    "url": {"type": "string", "component": "Input", "placeholder": "https://"},
    "number": {"type": "number", "component": "InputNumber"},
    "boolean": {"type": "boolean", "component": "Switch"},
    "select": {"type": "string", "component": "Select"},
}

# 提供商定义
PROVIDER_DEFINITIONS: Dict[str, ProviderDefinition] = {
    "openai": {
        "id": "openai",
        "name": "OpenAI",
        "description": "OpenAI官方API服务",
        "icon": "openai",
        "website": "https://openai.com",
        "support_custom_models": True,
        "fields": [
            {
                "key": "api_key",
                "name": "API Key",
                "type": "password",
                "required": True,
                "description": "OpenAI API密钥",
                "placeholder": "sk-..."
            },
            {
                "key": "base_url",
                "name": "Base URL",
                "type": "url",
                "required": False,
                "description": "自定义API端点（可选）",
                "default": "https://api.openai.com/v1",
                "placeholder": "https://api.openai.com/v1"
            },
            {
                "key": "organization",
                "name": "Organization",
                "type": "string",
                "required": False,
                "description": "组织ID（可选）",
                "placeholder": "org-..."
            }
        ],
        "default_models": [
            {
                "model_id": "gpt-4.1",
                "name": "GPT-4.1",
                "description": "最新的GPT-4.1模型，平衡性能和成本",
                "context_window": 128000,
                "input_cost_per_token": 0.000002,
                "output_cost_per_token": 0.000008,
                "supports_streaming": True,
                "supports_tools": True,
                "supports_vision": True,
                "is_default": True
            },
            {
                "model_id": "gpt-4.1-mini",
                "name": "GPT-4.1 Mini",
                "description": "更便宜的GPT-4.1版本",
                "context_window": 128000,
                "input_cost_per_token": 0.0000002,
                "output_cost_per_token": 0.0000008,
                "supports_streaming": True,
                "supports_tools": True,
                "supports_vision": True,
                "is_default": False
            },
            {
                "model_id": "gpt-4.1-nano",
                "name": "GPT-4.1 Nano",
                "description": "最便宜的GPT-4.1版本",
                "context_window": 128000,
                "input_cost_per_token": 0.0000001,
                "output_cost_per_token": 0.0000004,
                "supports_streaming": True,
                "supports_tools": True,
                "supports_vision": True,
                "is_default": False
            },
            {
                "model_id": "gpt-4o",
                "name": "GPT-4o",
                "description": "最新的GPT-4o模型，平衡性能和成本",
                "context_window": 128000,
                "input_cost_per_token": 0.0000025,
                "output_cost_per_token": 0.00001,
                "supports_streaming": True,
                "supports_tools": True,
                "supports_vision": True,
                "is_default": False
            },
            {
                "model_id": "gpt-4o-mini",
                "name": "GPT-4o Mini",
                "description": "更快更便宜的GPT-4o版本",
                "context_window": 128000,
                "input_cost_per_token": 0.00000015,
                "output_cost_per_token": 0.0000006,
                "supports_streaming": True,
                "supports_tools": True,
                "supports_vision": True,
                "is_default": False
            },
            {
                "model_id": "o1",
                "name": "OpenAI o1",
                "description": "推理能力最强的模型",
                "context_window": 200000,
                "input_cost_per_token": 0.000015,
                "output_cost_per_token": 0.00006,
                "supports_streaming": False,
                "supports_tools": False,
                "supports_vision": True,
                "is_default": False
            },
            {
                "model_id": "o1-mini",
                "name": "OpenAI o1-mini",
                "description": "更便宜的推理模型",
                "context_window": 128000,
                "input_cost_per_token": 0.0000011,
                "output_cost_per_token": 0.0000044,
                "supports_streaming": False,
                "supports_tools": False,
                "supports_vision": True,
                "is_default": False
            }
        ]
    },

    "anthropic": {
        "id": "anthropic",
        "name": "Anthropic",
        "description": "Anthropic Claude系列模型",
        "icon": "anthropic",
        "website": "https://anthropic.com",
        "fields": [
            {
                "key": "api_key",
                "name": "API Key",
                "type": "password",
                "required": True,
                "description": "Anthropic API密钥",
                "placeholder": "sk-ant-..."
            },
            {
                "key": "base_url",
                "name": "Base URL",
                "type": "url",
                "required": False,
                "description": "自定义API端点（可选）",
                "default": "https://api.anthropic.com",
                "placeholder": "https://api.anthropic.com"
            }
        ],
        "default_models": [
            {
                "model_id": "claude-3-5-sonnet-20241022",
                "name": "Claude 3.5 Sonnet",
                "description": "最新版本的Claude 3.5 Sonnet",
                "context_window": 200000,
                "input_cost_per_token": 0.000003,
                "output_cost_per_token": 0.000015,
                "supports_streaming": True,
                "supports_tools": True,
                "supports_vision": True,
                "is_default": True
            },
            {
                "model_id": "claude-3-5-haiku-20241022",
                "name": "Claude 3.5 Haiku",
                "description": "快速且经济的Claude模型",
                "context_window": 200000,
                "input_cost_per_token": 0.0000008,
                "output_cost_per_token": 0.000004,
                "supports_streaming": True,
                "supports_tools": True,
                "supports_vision": True,
                "is_default": False
            },
            {
                "model_id": "claude-3-opus-20240229",
                "name": "Claude 3 Opus",
                "description": "最强大的Claude模型",
                "context_window": 200000,
                "input_cost_per_token": 0.000015,
                "output_cost_per_token": 0.000075,
                "supports_streaming": True,
                "supports_tools": True,
                "supports_vision": True,
                "is_default": False
            }
        ]
    },

    "azure": {
        "id": "azure",
        "name": "Azure OpenAI",
        "description": "微软Azure上的OpenAI服务",
        "icon": "azure",
        "website": "https://azure.microsoft.com/en-us/products/ai-services/openai-service",
        "fields": [
            {
                "key": "api_key",
                "name": "API Key",
                "type": "password",
                "required": True,
                "description": "Azure OpenAI API密钥",
                "placeholder": "..."
            },
            {
                "key": "base_url",
                "name": "Base URL",
                "type": "url",
                "required": True,
                "description": "Azure OpenAI服务端点",
                "placeholder": "https://your-resource.openai.azure.com"
            },
            {
                "key": "api_version",
                "name": "API Version",
                "type": "string",
                "required": True,
                "description": "API版本",
                "default": "2024-08-01-preview",
                "placeholder": "2024-08-01-preview"
            }
        ],
        "default_models": [
            {
                "model_id": "gpt-4.1",
                "name": "GPT-4.1",
                "description": "最新的GPT-4.1模型，平衡性能和成本",
                "context_window": 128000,
                "input_cost_per_token": 0.000002,
                "output_cost_per_token": 0.000008,
                "supports_streaming": True,
                "supports_tools": True,
                "supports_vision": True,
                "is_default": True
            },
            {
                "model_id": "gpt-4.1-mini",
                "name": "GPT-4.1 Mini",
                "description": "更便宜的GPT-4.1版本",
                "context_window": 128000,
                "input_cost_per_token": 0.0000002,
                "output_cost_per_token": 0.0000008,
                "supports_streaming": True,
                "supports_tools": True,
                "supports_vision": True,
                "is_default": False
            },
            {
                "model_id": "gpt-4.1-nano",
                "name": "GPT-4.1 Nano",
                "description": "最便宜的GPT-4.1版本",
                "context_window": 128000,
                "input_cost_per_token": 0.0000001,
                "output_cost_per_token": 0.0000004,
                "supports_streaming": True,
                "supports_tools": True,
                "supports_vision": True,
                "is_default": False
            },
            {
                "model_id": "gpt-4o",
                "name": "GPT-4o",
                "description": "最新的GPT-4o模型，平衡性能和成本",
                "context_window": 128000,
                "input_cost_per_token": 0.0000025,
                "output_cost_per_token": 0.00001,
                "supports_streaming": True,
                "supports_tools": True,
                "supports_vision": True,
                "is_default": False
            },
            {
                "model_id": "gpt-4o-mini",
                "name": "GPT-4o Mini",
                "description": "更快更便宜的GPT-4o版本",
                "context_window": 128000,
                "input_cost_per_token": 0.00000015,
                "output_cost_per_token": 0.0000006,
                "supports_streaming": True,
                "supports_tools": True,
                "supports_vision": True,
                "is_default": False
            }
        ]
    },

    "dashscope": {
        "id": "dashscope",
        "name": "阿里云通义千问",
        "description": "阿里云通义千问大语言模型服务",
        "icon": "dashscope",
        "website": "https://dashscope.aliyun.com",
        "fields": [
            {
                "key": "api_key",
                "name": "API Key",
                "type": "password",
                "required": True,
                "description": "阿里云DashScope API密钥",
                "placeholder": "sk-..."
            },
            {
                "key": "base_url",
                "name": "Base URL",
                "type": "url",
                "required": False,
                "description": "自定义API端点（可选）",
                "default": "https://dashscope.aliyuncs.com/api/v1",
                "placeholder": "https://dashscope.aliyuncs.com/api/v1"
            }
        ],
        "default_models": [
            {
                "model_id": "qwen-turbo-latest",
                "name": "通义千问Turbo",
                "description": "通义千问最新快速版本",
                "context_window": 131072,
                "input_cost_per_token": 0.0000008,
                "output_cost_per_token": 0.000002,
                "supports_streaming": True,
                "supports_tools": True,
                "supports_vision": False,
                "is_default": True
            },
            {
                "model_id": "qwen-plus-latest",
                "name": "通义千问Plus",
                "description": "通义千问增强版本",
                "context_window": 131072,
                "input_cost_per_token": 0.000004,
                "output_cost_per_token": 0.000012,
                "supports_streaming": True,
                "supports_tools": True,
                "supports_vision": False,
                "is_default": False
            },
            {
                "model_id": "qwen-max",
                "name": "通义千问Max",
                "description": "通义千问最强版本",
                "context_window": 200000,
                "input_cost_per_token": 0.00004,
                "output_cost_per_token": 0.00012,
                "supports_streaming": True,
                "supports_tools": True,
                "supports_vision": True,
                "is_default": False
            },
            {
                "model_id": "qwen-vl-max",
                "name": "通义千问VL-Max",
                "description": "通义千问多模态大模型",
                "context_window": 32768,
                "input_cost_per_token": 0.00004,
                "output_cost_per_token": 0.00012,
                "supports_streaming": True,
                "supports_tools": True,
                "supports_vision": True,
                "is_default": False
            }
        ]
    },

    "gemini": {
        "id": "gemini",
        "name": "Google AI",
        "description": "Google Gemini系列模型",
        "icon": "google",
        "website": "https://ai.google.dev",
        "fields": [
            {
                "key": "api_key",
                "name": "API Key",
                "type": "password",
                "required": True,
                "description": "Google AI API密钥",
                "placeholder": "AI..."
            }
        ],
        "default_models": [
            {
                "model_id": "gemini-1.5-pro",
                "name": "Gemini 1.5 Pro",
                "description": "Google最新的大型语言模型",
                "context_window": 2000000,
                "input_cost_per_token": 0.00000125,
                "output_cost_per_token": 0.000005,
                "supports_streaming": True,
                "supports_tools": True,
                "supports_vision": True,
                "is_default": True
            },
            {
                "model_id": "gemini-1.5-flash",
                "name": "Gemini 1.5 Flash",
                "description": "快速且经济的Gemini模型",
                "context_window": 1000000,
                "input_cost_per_token": 0.000000075,
                "output_cost_per_token": 0.0000003,
                "supports_streaming": True,
                "supports_tools": True,
                "supports_vision": True,
                "is_default": False
            },
            {
                "model_id": "gemini-1.5-flash-002",
                "name": "Gemini 1.5 Flash-002",
                "description": "Gemini 1.5 Flash改进版本",
                "context_window": 1048576,
                "input_cost_per_token": 0.000000075,
                "output_cost_per_token": 0.0000003,
                "supports_streaming": True,
                "supports_tools": True,
                "supports_vision": True,
                "is_default": False
            },
            {
                "model_id": "gemini-2.0-flash-exp",
                "name": "Gemini 2.0 Flash (实验版)",
                "description": "Google最新实验版Gemini 2.0模型",
                "context_window": 1000000,
                "input_cost_per_token": 0.000000075,
                "output_cost_per_token": 0.0000003,
                "supports_streaming": True,
                "supports_tools": True,
                "supports_vision": True,
                "is_default": False
            }
        ]
    },

    "xai": {
        "id": "xai",
        "name": "xAI",
        "description": "Elon Musk的xAI公司开发的Grok模型",
        "icon": "xai",
        "website": "https://x.ai",
        "fields": [
            {
                "key": "api_key",
                "name": "API Key",
                "type": "password",
                "required": True,
                "description": "xAI API密钥",
                "placeholder": "xai-..."
            },
            {
                "key": "base_url",
                "name": "Base URL",
                "type": "url",
                "required": False,
                "description": "自定义API端点（可选）",
                "default": "https://api.x.ai/v1",
                "placeholder": "https://api.x.ai/v1"
            }
        ],
        "default_models": [
            {
                "model_id": "grok-beta",
                "name": "Grok Beta",
                "description": "xAI的Grok模型",
                "context_window": 131072,
                "input_cost_per_token": 0.000005,
                "output_cost_per_token": 0.000015,
                "supports_streaming": True,
                "supports_tools": True,
                "supports_vision": True,
                "is_default": False
            },
            {
                "model_id": "grok-2-1212",
                "name": "Grok-2",
                "description": "xAI最新Grok-2模型",
                "context_window": 131072,
                "input_cost_per_token": 0.000002,
                "output_cost_per_token": 0.00001,
                "supports_streaming": True,
                "supports_tools": True,
                "supports_vision": True,
                "is_default": True
            },
            {
                "model_id": "grok-2-vision-1212",
                "name": "Grok-2 Vision",
                "description": "xAI Grok-2视觉模型",
                "context_window": 131072,
                "input_cost_per_token": 0.000002,
                "output_cost_per_token": 0.00001,
                "supports_streaming": True,
                "supports_tools": True,
                "supports_vision": True,
                "is_default": False
            }
        ]
    },

    "deepseek": {
        "id": "deepseek",
        "name": "DeepSeek",
        "description": "DeepSeek深度求索系列模型",
        "icon": "deepseek",
        "website": "https://deepseek.com",
        "fields": [
            {
                "key": "api_key",
                "name": "API Key",
                "type": "password",
                "required": True,
                "description": "DeepSeek API密钥",
                "placeholder": "sk-..."
            },
            {
                "key": "base_url",
                "name": "Base URL",
                "type": "url",
                "required": False,
                "description": "自定义API端点（可选）",
                "default": "https://api.deepseek.com",
                "placeholder": "https://api.deepseek.com"
            }
        ],
        "default_models": [
            {
                "model_id": "deepseek-chat",
                "name": "DeepSeek V3",
                "description": "DeepSeek V3大模型",
                "context_window": 64000,
                "input_cost_per_token": 0.000000055,
                "output_cost_per_token": 0.00000028,
                "supports_streaming": True,
                "supports_tools": True,
                "supports_vision": False,
                "is_default": True
            },
            {
                "model_id": "deepseek-reasoner",
                "name": "DeepSeek R1",
                "description": "DeepSeek最新推理模型",
                "context_window": 64000,
                "input_cost_per_token": 0.000000055,
                "output_cost_per_token": 0.00000028,
                "supports_streaming": True,
                "supports_tools": True,
                "supports_vision": False,
                "is_default": False
            },
            {
                "model_id": "deepseek-coder",
                "name": "DeepSeek Coder",
                "description": "DeepSeek专业代码模型",
                "context_window": 128000,
                "input_cost_per_token": 0.00000014,
                "output_cost_per_token": 0.00000028,
                "supports_streaming": True,
                "supports_tools": True,
                "supports_vision": False,
                "is_default": False
            }
        ]
    },

    "cerebras": {
        "id": "cerebras",
        "name": "Cerebras",
        "description": "Cerebras超高速推理服务",
        "icon": "cerebras",
        "website": "https://cerebras.ai",
        "fields": [
            {
                "key": "api_key",
                "name": "API Key",
                "type": "password",
                "required": True,
                "description": "Cerebras API密钥",
                "placeholder": "csk-..."
            },
            {
                "key": "base_url",
                "name": "Base URL",
                "type": "url",
                "required": False,
                "description": "自定义API端点（可选）",
                "default": "https://api.cerebras.ai/v1",
                "placeholder": "https://api.cerebras.ai/v1"
            }
        ],
        "default_models": [
            {
                "model_id": "llama-3.3-70b",
                "name": "Llama 3.3 70B",
                "description": "Meta Llama 3.3 70B模型",
                "context_window": 128000,
                "input_cost_per_token": 0.00000085,
                "output_cost_per_token": 0.0000012,
                "supports_streaming": True,
                "supports_tools": True,
                "supports_vision": False,
                "is_default": True
            },
            {
                "model_id": "llama-4-scout-17b-16e-instruct",
                "name": "Llama 4 Scout 17B",
                "description": "Meta Llama 4 Scout 17B模型",
                "context_window": 128000,
                "input_cost_per_token": 0.00000065,
                "output_cost_per_token": 0.00000085,
                "supports_streaming": True,
                "supports_tools": True,
                "supports_vision": False,
                "is_default": False
            },
            {
                "model_id": "qwen-3-32b",
                "name": "Qwen 3.3 32B",
                "description": "Meta Qwen 3.3 32B模型",
                "context_window": 128000,
                "input_cost_per_token": 0.0000004,
                "output_cost_per_token": 0.0000008,
                "supports_streaming": True,
                "supports_tools": True,
                "supports_vision": False,
                "is_default": False
            },
            {
                "model_id": "qwen-3-235b-a22b",
                "name": "Qwen 3.3 235B",
                "description": "Meta Qwen 3.3 235B模型",
                "context_window": 128000,
                "input_cost_per_token": 0.0000006,
                "output_cost_per_token": 0.0000012,
                "supports_streaming": True,
                "supports_tools": True,
                "supports_vision": False,
                "is_default": False
            },
            {
                "model_id": "llama3.1-8b",
                "name": "Llama 3.1 8B",
                "description": "Meta Llama 3.1 8B模型",
                "context_window": 128000,
                "input_cost_per_token": 0.0000001,
                "output_cost_per_token": 0.0000001,
                "supports_streaming": True,
                "supports_tools": True,
                "supports_vision": False,
                "is_default": False
            },
            {
                "model_id": "llama3.1-70b",
                "name": "Llama 3.1 70B",
                "description": "Meta Llama 3.1 70B模型",
                "context_window": 128000,
                "input_cost_per_token": 0.0000006,
                "output_cost_per_token": 0.0000006,
                "supports_streaming": True,
                "supports_tools": True,
                "supports_vision": False,
                "is_default": False
            }
        ]
    },

    "groq": {
        "id": "groq",
        "name": "Groq",
        "description": "Groq超高速LLM推理",
        "icon": "groq",
        "website": "https://groq.com",
        "fields": [
            {
                "key": "api_key",
                "name": "API Key",
                "type": "password",
                "required": True,
                "description": "Groq API密钥",
                "placeholder": "gsk_..."
            }
        ],
        "default_models": [
            {
                "model_id": "llama-3.3-70b-versatile",
                "name": "Llama 3.3 70B",
                "description": "Meta Llama 3.3 70B模型",
                "context_window": 32768,
                "input_cost_per_token": 0.00000059,
                "output_cost_per_token": 0.00000079,
                "supports_streaming": True,
                "supports_tools": True,
                "supports_vision": False,
                "is_default": True
            },
            {
                "model_id": "deepseek-r1-distill-llama-70b",
                "name": "DeepSeek R1 Distill 70B",
                "description": "DeepSeek R1蒸馏版Llama 70B模型",
                "context_window": 128000,
                "input_cost_per_token": 0.00000075,
                "output_cost_per_token": 0.00000099,
                "supports_streaming": True,
                "supports_tools": True,
                "supports_vision": False,
                "is_default": False
            },
            {
                "model_id": "llama-3.3-70b-specdec",
                "name": "Llama 3.3 70B SpecDec",
                "description": "Llama 3.3 70B投机解码版本",
                "context_window": 8192,
                "input_cost_per_token": 0.00000059,
                "output_cost_per_token": 0.00000099,
                "supports_streaming": True,
                "supports_tools": True,
                "supports_vision": False,
                "is_default": False
            },
            {
                "model_id": "llama-3.1-8b-instant",
                "name": "Llama 3.1 8B Instant",
                "description": "超快的Llama 3.1 8B模型",
                "context_window": 131072,
                "input_cost_per_token": 0.00000005,
                "output_cost_per_token": 0.00000008,
                "supports_streaming": True,
                "supports_tools": True,
                "supports_vision": False,
                "is_default": False
            },
            {
                "model_id": "llama-guard-3-8b",
                "name": "Llama Guard 3 8B",
                "description": "Llama Guard安全检测模型",
                "context_window": 8192,
                "input_cost_per_token": 0.0000002,
                "output_cost_per_token": 0.0000002,
                "supports_streaming": True,
                "supports_tools": False,
                "supports_vision": False,
                "is_default": False
            },
            {
                "model_id": "llama2-70b-4096",
                "name": "Llama 2 70B",
                "description": "Meta Llama 2 70B模型",
                "context_window": 4096,
                "input_cost_per_token": 0.0000007,
                "output_cost_per_token": 0.0000008,
                "supports_streaming": True,
                "supports_tools": False,
                "supports_vision": False,
                "is_default": False
            },
            {
                "model_id": "llama3-8b-8192",
                "name": "Llama 3 8B",
                "description": "Meta Llama 3 8B模型",
                "context_window": 8192,
                "input_cost_per_token": 0.00000005,
                "output_cost_per_token": 0.00000008,
                "supports_streaming": True,
                "supports_tools": True,
                "supports_vision": False,
                "is_default": False
            }
        ]
    },

    "cohere": {
        "id": "cohere",
        "name": "Cohere",
        "description": "Cohere企业级AI平台",
        "icon": "cohere",
        "website": "https://cohere.ai",
        "fields": [
            {
                "key": "api_key",
                "name": "API Key",
                "type": "password",
                "required": True,
                "description": "Cohere API密钥",
                "placeholder": "..."
            }
        ],
        "default_models": [
            {
                "model_id": "command-r-plus-08-2024",
                "name": "Command R+",
                "description": "Cohere最强大的Command模型",
                "context_window": 128000,
                "input_cost_per_token": 0.000002,
                "output_cost_per_token": 0.00001,
                "supports_streaming": True,
                "supports_tools": True,
                "supports_vision": False,
                "is_default": True
            },
            {
                "model_id": "command-r-08-2024",
                "name": "Command R",
                "description": "平衡性能的Command模型",
                "context_window": 128000,
                "input_cost_per_token": 0.00000015,
                "output_cost_per_token": 0.0000006,
                "supports_streaming": True,
                "supports_tools": True,
                "supports_vision": False,
                "is_default": False
            }
        ]
    },

    "fireworks": {
        "id": "fireworks",
        "name": "Fireworks AI",
        "description": "Fireworks AI高速推理平台",
        "icon": "fireworks",
        "website": "https://fireworks.ai",
        "fields": [
            {
                "key": "api_key",
                "name": "API Key",
                "type": "password",
                "required": True,
                "description": "Fireworks AI API密钥",
                "placeholder": "fw_..."
            }
        ],
        "default_models": [
            {
                "model_id": "accounts/fireworks/models/llama-v3p1-70b-instruct",
                "name": "Llama 3.1 70B Instruct",
                "description": "Meta Llama 3.1 70B指令调优模型",
                "context_window": 131072,
                "input_cost_per_token": 0.0000009,
                "output_cost_per_token": 0.0000009,
                "supports_streaming": True,
                "supports_tools": True,
                "supports_vision": False,
                "is_default": True
            },
            {
                "model_id": "accounts/fireworks/models/llama-v3p1-8b-instruct",
                "name": "Llama 3.1 8B Instruct",
                "description": "Meta Llama 3.1 8B指令调优模型",
                "context_window": 131072,
                "input_cost_per_token": 0.0000002,
                "output_cost_per_token": 0.0000002,
                "supports_streaming": True,
                "supports_tools": True,
                "supports_vision": False,
                "is_default": False
            }
        ]
    },

    "perplexity": {
        "id": "perplexity",
        "name": "Perplexity",
        "description": "Perplexity在线推理模型",
        "icon": "perplexity",
        "website": "https://perplexity.ai",
        "fields": [
            {
                "key": "api_key",
                "name": "API Key",
                "type": "password",
                "required": True,
                "description": "Perplexity API密钥",
                "placeholder": "pplx-..."
            }
        ],
        "default_models": [
            {
                "model_id": "llama-3.1-sonar-small-128k-online",
                "name": "Sonar Small Online",
                "description": "Llama 3.1 Sonar小型在线模型",
                "context_window": 127072,
                "input_cost_per_token": 0.0000002,
                "output_cost_per_token": 0.0000002,
                "supports_streaming": True,
                "supports_tools": False,
                "supports_vision": False,
                "is_default": True
            },
            {
                "model_id": "llama-3.1-sonar-large-128k-online",
                "name": "Sonar Large Online",
                "description": "Llama 3.1 Sonar大型在线模型",
                "context_window": 127072,
                "input_cost_per_token": 0.000001,
                "output_cost_per_token": 0.000001,
                "supports_streaming": True,
                "supports_tools": False,
                "supports_vision": False,
                "is_default": False
            },
            {
                "model_id": "llama-3.1-sonar-huge-128k-online",
                "name": "Sonar Huge Online",
                "description": "Llama 3.1 Sonar超大型在线模型",
                "context_window": 127072,
                "input_cost_per_token": 0.000005,
                "output_cost_per_token": 0.000005,
                "supports_streaming": True,
                "supports_tools": False,
                "supports_vision": False,
                "is_default": False
            }
        ]
    },

    "together": {
        "id": "together",
        "name": "Together AI",
        "description": "Together AI开源模型推理平台",
        "icon": "together",
        "website": "https://together.ai",
        "fields": [
            {
                "key": "api_key",
                "name": "API Key",
                "type": "password",
                "required": True,
                "description": "Together AI API密钥",
                "placeholder": "..."
            }
        ],
        "default_models": [
            {
                "model_id": "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
                "name": "Llama 3.1 70B Turbo",
                "description": "Meta Llama 3.1 70B Turbo优化版",
                "context_window": 131072,
                "input_cost_per_token": 0.00000088,
                "output_cost_per_token": 0.00000088,
                "supports_streaming": True,
                "supports_tools": True,
                "supports_vision": False,
                "is_default": True
            },
            {
                "model_id": "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
                "name": "Llama 3.1 8B Turbo",
                "description": "Meta Llama 3.1 8B Turbo优化版",
                "context_window": 131072,
                "input_cost_per_token": 0.0000002,
                "output_cost_per_token": 0.0000002,
                "supports_streaming": True,
                "supports_tools": True,
                "supports_vision": False,
                "is_default": False
            },
            {
                "model_id": "Qwen/Qwen2.5-72B-Instruct-Turbo",
                "name": "Qwen 2.5 72B Turbo",
                "description": "阿里巴巴Qwen 2.5 72B Turbo模型",
                "context_window": 32768,
                "input_cost_per_token": 0.00000059,
                "output_cost_per_token": 0.00000059,
                "supports_streaming": True,
                "supports_tools": True,
                "supports_vision": False,
                "is_default": False
            }
                 ]
     },

    "mistral": {
        "id": "mistral",
        "name": "Mistral AI",
        "description": "Mistral AI高性能模型",
        "icon": "mistral",
        "website": "https://mistral.ai",
        "fields": [
            {
                "key": "api_key",
                "name": "API Key",
                "type": "password",
                "required": True,
                "description": "Mistral API密钥",
                "placeholder": "..."
            }
        ],
        "default_models": [
            {
                "model_id": "mistral-large-latest",
                "name": "Mistral Large",
                "description": "Mistral最大规模模型",
                "context_window": 128000,
                "input_cost_per_token": 0.000002,
                "output_cost_per_token": 0.000006,
                "supports_streaming": True,
                "supports_tools": True,
                "supports_vision": False,
                "is_default": True
            },
            {
                "model_id": "mistral-small-latest",
                "name": "Mistral Small",
                "description": "Mistral小型高效模型",
                "context_window": 128000,
                "input_cost_per_token": 0.0000002,
                "output_cost_per_token": 0.0000006,
                "supports_streaming": True,
                "supports_tools": True,
                "supports_vision": False,
                "is_default": False
            },
            {
                "model_id": "pixtral-12b-2409",
                "name": "Pixtral 12B",
                "description": "Mistral多模态视觉模型",
                "context_window": 128000,
                "input_cost_per_token": 0.00000015,
                "output_cost_per_token": 0.00000015,
                "supports_streaming": True,
                "supports_tools": True,
                "supports_vision": True,
                "is_default": False
            }
        ]
    },

    "ai21": {
        "id": "ai21",
        "name": "AI21 Labs",
        "description": "AI21 Labs Jurassic系列模型",
        "icon": "ai21",
        "website": "https://ai21.com",
        "fields": [
            {
                "key": "api_key",
                "name": "API Key",
                "type": "password",
                "required": True,
                "description": "AI21 API密钥",
                "placeholder": "..."
            }
        ],
        "default_models": [
            {
                "model_id": "jamba-1.5-large",
                "name": "Jamba 1.5 Large",
                "description": "AI21最新大型混合专家模型",
                "context_window": 256000,
                "input_cost_per_token": 0.000002,
                "output_cost_per_token": 0.000008,
                "supports_streaming": True,
                "supports_tools": True,
                "supports_vision": False,
                "is_default": True
            },
            {
                "model_id": "jamba-1.5-mini",
                "name": "Jamba 1.5 Mini",
                "description": "AI21轻量级高效模型",
                "context_window": 256000,
                "input_cost_per_token": 0.0000002,
                "output_cost_per_token": 0.0000004,
                "supports_streaming": True,
                "supports_tools": True,
                "supports_vision": False,
                "is_default": False
            }
        ]
    },

    "replicate": {
        "id": "replicate",
        "name": "Replicate",
        "description": "Replicate开源模型托管平台",
        "icon": "replicate",
        "website": "https://replicate.com",
        "fields": [
            {
                "key": "api_key",
                "name": "API Key",
                "type": "password",
                "required": True,
                "description": "Replicate API密钥",
                "placeholder": "r8_..."
            }
        ],
        "default_models": [
            {
                "model_id": "meta/llama-2-70b-chat",
                "name": "Llama 2 70B Chat",
                "description": "Meta Llama 2 70B对话模型",
                "context_window": 4096,
                "input_cost_per_token": 0.00000065,
                "output_cost_per_token": 0.00000275,
                "supports_streaming": True,
                "supports_tools": False,
                "supports_vision": False,
                "is_default": True
            },
            {
                "model_id": "meta/llama-2-13b-chat",
                "name": "Llama 2 13B Chat",
                "description": "Meta Llama 2 13B对话模型",
                "context_window": 4096,
                "input_cost_per_token": 0.0000001,
                "output_cost_per_token": 0.0000005,
                "supports_streaming": True,
                "supports_tools": False,
                "supports_vision": False,
                "is_default": False
            },
            {
                "model_id": "stability-ai/stable-diffusion-3",
                "name": "Stable Diffusion 3",
                "description": "Stability AI图像生成模型",
                "context_window": 1024,
                "input_cost_per_token": 0.000035,
                "output_cost_per_token": 0.0,
                "supports_streaming": False,
                "supports_tools": False,
                "supports_vision": True,
                "is_default": False
            }
        ]
    },

    "voyageai": {
        "id": "voyageai",
        "name": "Voyage AI",
        "description": "Voyage AI嵌入向量模型专家",
        "icon": "voyageai",
        "website": "https://voyageai.com",
        "fields": [
            {
                "key": "api_key",
                "name": "API Key",
                "type": "password",
                "required": True,
                "description": "Voyage AI API密钥",
                "placeholder": "pa-..."
            }
        ],
        "default_models": [
            {
                "model_id": "voyage-3",
                "name": "Voyage 3",
                "description": "最新版Voyage嵌入模型",
                "context_window": 32000,
                "input_cost_per_token": 0.00000012,
                "output_cost_per_token": 0.0,
                "supports_streaming": False,
                "supports_tools": False,
                "supports_vision": False,
                "is_default": True
            },
            {
                "model_id": "voyage-3-lite",
                "name": "Voyage 3 Lite",
                "description": "Voyage轻量级嵌入模型",
                "context_window": 32000,
                "input_cost_per_token": 0.00000007,
                "output_cost_per_token": 0.0,
                "supports_streaming": False,
                "supports_tools": False,
                "supports_vision": False,
                "is_default": False
            }
        ]
    },

    "jinaai": {
        "id": "jinaai",
        "name": "Jina AI",
        "description": "Jina AI神经搜索和多模态AI",
        "icon": "jinaai",
        "website": "https://jina.ai",
        "fields": [
            {
                "key": "api_key",
                "name": "API Key",
                "type": "password",
                "required": True,
                "description": "Jina AI API密钥",
                "placeholder": "jina_..."
            }
        ],
        "default_models": [
            {
                "model_id": "jina-embeddings-v3",
                "name": "Jina Embeddings v3",
                "description": "Jina最新嵌入模型",
                "context_window": 8192,
                "input_cost_per_token": 0.00000002,
                "output_cost_per_token": 0.0,
                "supports_streaming": False,
                "supports_tools": False,
                "supports_vision": False,
                "is_default": True
            },
            {
                "model_id": "jina-clip-v1",
                "name": "Jina CLIP v1",
                "description": "Jina多模态CLIP模型",
                "context_window": 8192,
                "input_cost_per_token": 0.00000002,
                "output_cost_per_token": 0.0,
                "supports_streaming": False,
                "supports_tools": False,
                "supports_vision": True,
                "is_default": False
            }
        ]
    },

    "huggingface": {
        "id": "huggingface",
        "name": "Hugging Face",
        "description": "Hugging Face开源模型社区",
        "icon": "huggingface",
        "website": "https://huggingface.co",
        "support_custom_models": True,
        "fields": [
            {
                "key": "api_key",
                "name": "API Key",
                "type": "password",
                "required": True,
                "description": "Hugging Face API密钥",
                "placeholder": "hf_..."
            },
            {
                "key": "base_url",
                "name": "Base URL",
                "type": "url",
                "required": False,
                "description": "自定义推理端点（可选）",
                "default": "https://api-inference.huggingface.co",
                "placeholder": "https://api-inference.huggingface.co"
            }
        ],
        "default_models": [
            {
                "model_id": "microsoft/DialoGPT-large",
                "name": "DialoGPT Large",
                "description": "微软对话生成模型",
                "context_window": 1024,
                "input_cost_per_token": 0.0,
                "output_cost_per_token": 0.0,
                "supports_streaming": True,
                "supports_tools": False,
                "supports_vision": False,
                "is_default": True
            },
            {
                "model_id": "meta-llama/Llama-2-7b-chat-hf",
                "name": "Llama 2 7B Chat",
                "description": "Meta Llama 2 7B对话模型",
                "context_window": 4096,
                "input_cost_per_token": 0.0,
                "output_cost_per_token": 0.0,
                "supports_streaming": True,
                "supports_tools": False,
                "supports_vision": False,
                "is_default": False
            },
            {
                "model_id": "microsoft/DialoGPT-medium",
                "name": "DialoGPT Medium",
                "description": "微软中型对话生成模型",
                "context_window": 1024,
                "input_cost_per_token": 0.0,
                "output_cost_per_token": 0.0,
                "supports_streaming": True,
                "supports_tools": False,
                "supports_vision": False,
                "is_default": False
            }
        ]
    },

    "bedrock": {
        "id": "bedrock",
        "name": "Amazon Bedrock",
        "description": "AWS Bedrock托管的基础模型",
        "icon": "bedrock",
        "website": "https://aws.amazon.com/bedrock",
        "fields": [
            {
                "key": "aws_access_key_id",
                "name": "AWS Access Key ID",
                "type": "password",
                "required": True,
                "description": "AWS访问密钥ID",
                "placeholder": "AKIA..."
            },
            {
                "key": "aws_secret_access_key",
                "name": "AWS Secret Access Key",
                "type": "password",
                "required": True,
                "description": "AWS私密访问密钥",
                "placeholder": "..."
            },
            {
                "key": "aws_region_name",
                "name": "AWS Region",
                "type": "string",
                "required": True,
                "description": "AWS区域",
                "default": "us-east-1",
                "placeholder": "us-east-1"
            }
        ],
        "default_models": [
            {
                "model_id": "anthropic.claude-3-sonnet-20240229-v1:0",
                "name": "Claude 3 Sonnet (Bedrock)",
                "description": "通过Bedrock访问的Claude 3 Sonnet",
                "context_window": 200000,
                "input_cost_per_token": 0.000003,
                "output_cost_per_token": 0.000015,
                "supports_streaming": True,
                "supports_tools": True,
                "supports_vision": True,
                "is_default": True
            },
            {
                "model_id": "anthropic.claude-3-haiku-20240307-v1:0",
                "name": "Claude 3 Haiku (Bedrock)",
                "description": "通过Bedrock访问的Claude 3 Haiku",
                "context_window": 200000,
                "input_cost_per_token": 0.00000025,
                "output_cost_per_token": 0.00000125,
                "supports_streaming": True,
                "supports_tools": True,
                "supports_vision": True,
                "is_default": False
            },
            {
                "model_id": "amazon.titan-text-express-v1",
                "name": "Titan Text Express",
                "description": "Amazon自研文本生成模型",
                "context_window": 8000,
                "input_cost_per_token": 0.0000008,
                "output_cost_per_token": 0.0000016,
                "supports_streaming": True,
                "supports_tools": False,
                "supports_vision": False,
                "is_default": False
            }
        ]
    },

    "ollama": {
        "id": "ollama",
        "name": "Ollama",
        "description": "本地运行大型语言模型",
        "icon": "ollama",
        "website": "https://ollama.ai",
        "fields": [
            {
                "key": "base_url",
                "name": "Base URL",
                "type": "url",
                "required": False,
                "description": "Ollama服务地址",
                "default": "http://localhost:11434",
                "placeholder": "http://localhost:11434"
            }
        ],
        "default_models": [
            {
                "model_id": "llama3.2",
                "name": "Llama 3.2",
                "description": "Meta Llama 3.2本地模型",
                "context_window": 128000,
                "input_cost_per_token": 0.0,
                "output_cost_per_token": 0.0,
                "supports_streaming": True,
                "supports_tools": True,
                "supports_vision": False,
                "is_default": True
            },
            {
                "model_id": "qwen2.5",
                "name": "Qwen 2.5",
                "description": "阿里通义千问2.5本地模型",
                "context_window": 32768,
                "input_cost_per_token": 0.0,
                "output_cost_per_token": 0.0,
                "supports_streaming": True,
                "supports_tools": True,
                "supports_vision": False,
                "is_default": False
            },
            {
                "model_id": "llama3.2-vision",
                "name": "Llama 3.2 Vision",
                "description": "Meta Llama 3.2视觉模型",
                "context_window": 128000,
                "input_cost_per_token": 0.0,
                "output_cost_per_token": 0.0,
                "supports_streaming": True,
                "supports_tools": True,
                "supports_vision": True,
                "is_default": False
            },
            {
                "model_id": "codellama",
                "name": "Code Llama",
                "description": "Meta专业代码生成模型",
                "context_window": 16384,
                "input_cost_per_token": 0.0,
                "output_cost_per_token": 0.0,
                "supports_streaming": True,
                "supports_tools": True,
                "supports_vision": False,
                "is_default": False
            }
        ]
    },

    "cloudflare": {
        "id": "cloudflare",
        "name": "Cloudflare Workers AI",
        "description": "Cloudflare边缘AI推理服务",
        "icon": "cloudflare",
        "website": "https://developers.cloudflare.com/workers-ai",
        "fields": [
            {
                "key": "api_key",
                "name": "API Token",
                "type": "password",
                "required": True,
                "description": "Cloudflare API Token",
                "placeholder": "..."
            },
            {
                "key": "account_id",
                "name": "Account ID",
                "type": "string",
                "required": True,
                "description": "Cloudflare账户ID",
                "placeholder": "..."
            }
        ],
        "default_models": [
            {
                "model_id": "@cf/meta/llama-3.1-8b-instruct",
                "name": "Llama 3.1 8B Instruct",
                "description": "通过Cloudflare Workers AI运行的Llama 3.1",
                "context_window": 128000,
                "input_cost_per_token": 0.0,
                "output_cost_per_token": 0.0,
                "supports_streaming": True,
                "supports_tools": False,
                "supports_vision": False,
                "is_default": True
            },
            {
                "model_id": "@cf/microsoft/phi-2",
                "name": "Microsoft Phi-2",
                "description": "微软Phi-2小型语言模型",
                "context_window": 2048,
                "input_cost_per_token": 0.0,
                "output_cost_per_token": 0.0,
                "supports_streaming": True,
                "supports_tools": False,
                "supports_vision": False,
                "is_default": False
            }
        ]
    },

    "deepinfra": {
        "id": "deepinfra",
        "name": "DeepInfra",
        "description": "DeepInfra云端AI模型推理",
        "icon": "deepinfra",
        "website": "https://deepinfra.com",
        "fields": [
            {
                "key": "api_key",
                "name": "API Key",
                "type": "password",
                "required": True,
                "description": "DeepInfra API密钥",
                "placeholder": "..."
            }
        ],
        "default_models": [
            {
                "model_id": "meta-llama/Meta-Llama-3.1-70B-Instruct",
                "name": "Llama 3.1 70B Instruct",
                "description": "Meta Llama 3.1 70B指令调优模型",
                "context_window": 128000,
                "input_cost_per_token": 0.00000052,
                "output_cost_per_token": 0.00000075,
                "supports_streaming": True,
                "supports_tools": True,
                "supports_vision": False,
                "is_default": True
            },
            {
                "model_id": "meta-llama/Meta-Llama-3.1-8B-Instruct",
                "name": "Llama 3.1 8B Instruct",
                "description": "Meta Llama 3.1 8B指令调优模型",
                "context_window": 128000,
                "input_cost_per_token": 0.000000055,
                "output_cost_per_token": 0.000000055,
                "supports_streaming": True,
                "supports_tools": True,
                "supports_vision": False,
                "is_default": False
            },
            {
                "model_id": "microsoft/WizardLM-2-8x22B",
                "name": "WizardLM 2 8x22B",
                "description": "微软WizardLM 2混合专家模型",
                "context_window": 65536,
                "input_cost_per_token": 0.00000063,
                "output_cost_per_token": 0.00000063,
                "supports_streaming": True,
                "supports_tools": True,
                "supports_vision": False,
                "is_default": False
            }
        ]
    }
}


def get_provider_definition(provider_type: str) -> Dict[str, ProviderDefinition]:
    """获取提供商定义"""
    return PROVIDER_DEFINITIONS.get(provider_type, {})


def get_all_provider_definitions() -> Dict[str, Dict[str, ProviderDefinition]]:
    """获取所有提供商定义"""
    return PROVIDER_DEFINITIONS.copy()


def get_provider_default_models(provider_type: str) -> List[DefaultModel]:
    """获取提供商的默认模型列表"""
    provider = PROVIDER_DEFINITIONS.get(provider_type, {})
    return provider.get("default_models", [])


def get_provider_fields(provider_type: str) -> List[ProviderField]:
    """获取提供商的配置字段定义"""
    provider = PROVIDER_DEFINITIONS.get(provider_type, {})
    return provider.get("fields", []) 