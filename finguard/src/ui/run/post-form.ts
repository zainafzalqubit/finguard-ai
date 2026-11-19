export interface PostResult {
  ok: boolean;
  body: unknown;
}

/** POST a form and report upload progress (0..1). fetch() cannot report upload progress, XHR can. */
export function postForm(url: string, form: FormData, onProgress?: (fraction: number) => void): Promise<PostResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.responseType = "json";
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) onProgress?.(event.loaded / event.total);
    };
    xhr.onload = () => {
      onProgress?.(1);
      resolve({ ok: xhr.status >= 200 && xhr.status < 300, body: xhr.response });
    };
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.send(form);
  });
}
