import json

def extract_variables(json_template, json_data):
    template_content_list = [item["content"] for item in json_template]
    data_content_list = [item["content"] for item in json_data]

    # 同时遍历所有content，获取变量值, 合并到一个result里
    result = {}
    for template_content, data_content in zip(template_content_list, data_content_list):
        result.update(extract_variable(template_content, data_content))
    return result

def extract_variable(template, target):
    variable_names = []
    separators = []
    pos = 0
    while True:
        start = template.find("{{", pos)
        if start == -1:
            separators.append(template[pos:])
            break
        separators.append(template[pos:start])
        end = template.find("}}", start)
        variable_names.append(template[start + 2:end])
        pos = end + 2

    results = {}
    current_pos = 0
    for i, var_name in enumerate(variable_names):
        start_sep = separators[i]
        end_sep = separators[i + 1] if i + 1 < len(separators) else ""

        start_index = target.find(start_sep, current_pos)
        if start_index == -1:
            break
        start_index += len(start_sep)

        if end_sep:
            end_index = target.find(end_sep, start_index)
            if end_index == -1:
                break
            value = target[start_index:end_index]
            current_pos = end_index
        else:
            value = target[start_index:]

        results[var_name] = value

    return results


if __name__ == "__main__":
    template = """[{"role": "system", "content": "#Role\\n- You are a multilingual intent recognition and automated response expert.\\n\\n# Predefined Common Question Examples and Corresponding Reply Options\\n------\\n{{mostReply}}\\n------\\n- \\"questionText\\": Common question examples\\n- \\"answers\\": Common reply options corresponding to this type of question\\n\\n# Task\\n## 1. Identify the user's question intent, and based on the predefined common question examples, determine whether the corresponding \\"answers\\" can be used for a reply (intentFlag).\\n  - Set intentFlag=1\\n    - The user's question matches the common question examples.\\n  - Set intentFlag=0 (satisfying one of the following conditions)\\n    - The user's question does not have an inquiry intent; it is a general statement that does not require a reply.\\n    - The user's question does not match the predefined common question examples.\\n## 2. Extract and translate common replies (answers)\\n- Determine whether there are common replies matching the user's question. If common replies exist, return 1; otherwise, return 0, output to the field: intentFlag.\\n- If a common reply is matched, return its answers. Return the common reply information in the following format, saved in a JSON array: answers\\n  - answers.asrLn: One of the common replies.\\n  - answers.transLn: Translate the selected common reply into {{translatorLang}} language.\\n  - When common replies exist, the answers field cannot be empty.\\n# Output\\n## Output when a common reply is matched\\n{\\n  \\"intentFlag\\": 1,\\n  \\"intentType\\":\\"MostReply\\",\\n  \\"answers\\": [{\\"asrLn\\":\\"\\",\\"transLn\\":\\"\\"}]\\n}\\n## Output when no common reply is matched\\n{\\n  \\"intentFlag\\": 0,\\n}\\n\\n# Constraints\\n - Do not output any explanations, annotations, or descriptions.\\n - Do not output in markdown format, The output content must not contain ```json or ```.\\n - Do not include any explanations, only provide a RFC8259 compliant JSON response following this format without deviation.", "order": 0}, {"role": "user", "content": "User question: \\n------\\n{{content}}\\n------", "order": 1}]"""

    target = """[{"content":"#Role\\n- You are a multilingual intent recognition and automated response expert.\\n\\n# Predefined Common Question Examples and Corresponding Reply Options\\n------\\n[{\\"question_text\\":\\"Would you like the link to live agent chat, secure message, or both?\\",\\"answers\\":\\"[\\\\\\"Agent chat\\\\\\", \\\\\\"Secure message\\\\\\", \\\\\\"Both\\\\\\"]\\"},{\\"question_text\\":\\"Please tell me why you called today.\\",\\"answers\\":\\"[\\\\\\"Check Case Processing Times\\\\\\",\\\\\\"Check Case Status\\\\\\",\\\\\\"Non-Delivery of Card\\\\\\",\\\\\\"InfoPass\\\\\\"]\\"},{\\"question_text\\":\\"Are you calling about a biometric appointment, InfoPass appointment, or your interview?\\",\\"answers\\":\\"[\\\\\\"Check Case Processing Times\\\\\\",\\\\\\"Check Case Status\\\\\\",\\\\\\"Non-Delivery of Card\\\\\\",\\\\\\"InfoPass\\\\\\"]\\"},{\\"question_text\\":\\"So tell me, how can I help you?\\",\\"answers\\":\\"[\\\\\\"Check Case Processing Times\\\\\\",\\\\\\"Check Case Status\\\\\\",\\\\\\"Non-Delivery of Card\\\\\\",\\\\\\"InfoPass\\\\\\"]\\"},{\\"question_text\\":\\"I can understand complete sentences. So tell me, how can I help you?\\",\\"answers\\":\\"[\\\\\\"Check Case Processing Times\\\\\\",\\\\\\"Check Case Status\\\\\\",\\\\\\"Non-Delivery of Card\\\\\\",\\\\\\"InfoPass\\\\\\"]\\"}]\\n------\\n- \\"questionText\\": Common question examples\\n- \\"answers\\": Common reply options corresponding to this type of question\\n\\n# Task\\n## 1. Identify the user's question intent, and based on the predefined common question examples, determine whether the corresponding \\"answers\\" can be used for a reply (intentFlag).\\n  - Set intentFlag=1\\n    - The user's question matches the common question examples.\\n  - Set intentFlag=0 (satisfying one of the following conditions)\\n    - The user's question does not have an inquiry intent; it is a general statement that does not require a reply.\\n    - The user's question does not match the predefined common question examples.\\n## 2. Extract and translate common replies (answers)\\n- Determine whether there are common replies matching the user's question. If common replies exist, return 1; otherwise, return 0, output to the field: intentFlag.\\n- If a common reply is matched, return its answers. Return the common reply information in the following format, saved in a JSON array: answers\\n  - answers.asrLn: One of the common replies.\\n  - answers.transLn: Translate the selected common reply into zh-CN language.\\n  - When common replies exist, the answers field cannot be empty.\\n# Output\\n## Output when a common reply is matched\\n{\\n  \\"intentFlag\\": 1,\\n  \\"intentType\\":\\"MostReply\\",\\n  \\"answers\\": [{\\"asrLn\\":\\"\\",\\"transLn\\":\\"\\"}]\\n}\\n## Output when no common reply is matched\\n{\\n  \\"intentFlag\\": 0,\\n}\\n\\n# Constraints\\n - Do not output any explanations, annotations, or descriptions.\\n - Do not output in markdown format, The output content must not contain ```json or ```.\\n - Do not include any explanations, only provide a RFC8259 compliant JSON response following this format without deviation.","role":"system"},{"content":"User question: \\n------\\nThank you for calling USCIS. Have a great day.\\n------","role":"user"}]"""

    json_template = json.loads(template)
    json_data = json.loads(target)
    # 获取所有content内容

    result = extract_variables(json_template, json_data)
    print(json.dumps(result))
    # print(f"{result.get('mostReply')}\t{result.get('translatorLang')}\t{result.get('content')}")
