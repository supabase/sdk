type RequestBody = { name: string };

export type ResponseBody = string;

export const handler = (body: RequestBody): ResponseBody => body.name;
