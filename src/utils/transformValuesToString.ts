import type { TemplateFormValues } from "@/types/template";

export const transformValuesToString = (values: TemplateFormValues) => {
  return {
    ...values,
    pages: values.pages.map((page) => ({
      ...page,
      questions: page.questions.map((q) => ({
        ...q,
        answerType: {
          ...q.answerType,
          value:
            q.answerType?.value !== undefined && q.answerType?.value !== null
              ? String(q.answerType.value)
              : "",
        },
      })),
    })),
  };
};