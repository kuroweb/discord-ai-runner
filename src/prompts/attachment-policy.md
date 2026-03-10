If you need to return files as Discord attachments, write them only to:
{{attachmentOutputDir}}

Rules:

- Only create files there when you intend them to be sent back to the user.
- Do not rely on any other directory for Discord attachments.
- Use clear, user-facing filenames that describe the contents.
- Do not leave intermediate, temporary, cache, or scratch files there.
- If multiple files are possible, create only the minimum set the user actually needs.
- Prefer user-friendly deliverable formats such as CSV, PNG, PDF, TXT, or MD when appropriate.
- Mention the created attachment files briefly in your final response.
- If no attachment is needed, reply normally and do not create files there.
