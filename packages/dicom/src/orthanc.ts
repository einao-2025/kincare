/**
 * Thin Orthanc REST client (https://orthanc.uclouvain.be/book/users/rest.html).
 * Handles study upload + metadata retrieval. Uses fetch (Node 20+).
 */

export interface OrthancConfig {
  baseUrl: string;
  username?: string;
  password?: string;
}

export interface OrthancUploadResult {
  ID: string;            // instance id
  ParentSeries: string;
  ParentStudy: string;
  ParentPatient: string;
  Status: 'Success' | 'AlreadyStored' | string;
}

export interface OrthancStudy {
  ID: string;
  MainDicomTags: {
    StudyInstanceUID: string;
    StudyDate?: string;
    StudyDescription?: string;
    AccessionNumber?: string;
    ReferringPhysicianName?: string;
  };
  PatientMainDicomTags: {
    PatientID?: string;
    PatientName?: string;
    PatientSex?: string;
    PatientBirthDate?: string;
  };
  Series: string[];
}

export interface OrthancSeries {
  ID: string;
  MainDicomTags: {
    SeriesInstanceUID: string;
    SeriesNumber?: string;
    Modality?: string;
    BodyPartExamined?: string;
    SeriesDescription?: string;
  };
  Instances: string[];
}

export interface OrthancInstance {
  ID: string;
  MainDicomTags: {
    SOPInstanceUID: string;
    InstanceNumber?: string;
  };
}

export class OrthancClient {
  constructor(private readonly cfg: OrthancConfig) {}

  private headers(extra: Record<string, string> = {}): HeadersInit {
    const h: Record<string, string> = { Accept: 'application/json', ...extra };
    if (this.cfg.username) {
      const token = Buffer.from(`${this.cfg.username}:${this.cfg.password ?? ''}`).toString('base64');
      h.Authorization = `Basic ${token}`;
    }
    return h;
  }

  private async req<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${this.cfg.baseUrl}${path}`, {
      ...init,
      headers: { ...this.headers(), ...(init.headers ?? {}) },
    });
    if (!res.ok) {
      throw new Error(`Orthanc ${res.status} on ${path}: ${await res.text()}`);
    }
    return (await res.json()) as T;
  }

  async uploadInstance(dicomBytes: Buffer | Uint8Array): Promise<OrthancUploadResult> {
    const res = await fetch(`${this.cfg.baseUrl}/instances`, {
      method: 'POST',
      headers: this.headers({ 'Content-Type': 'application/dicom' }),
      body: dicomBytes as BodyInit,
    });
    if (!res.ok) throw new Error(`Orthanc upload failed: ${res.status} ${await res.text()}`);
    return (await res.json()) as OrthancUploadResult;
  }

  getStudy(id: string): Promise<OrthancStudy> { return this.req(`/studies/${id}`); }
  getSeries(id: string): Promise<OrthancSeries> { return this.req(`/series/${id}`); }
  getInstance(id: string): Promise<OrthancInstance> { return this.req(`/instances/${id}`); }

  /** WADO-URI for a single rendered frame (suitable for cornerstone-wado). */
  wadoFrameUrl(orthancInstanceId: string): string {
    return `${this.cfg.baseUrl}/instances/${orthancInstanceId}/preview`;
  }

  /** WADO-RS study URI for cornerstone3D. */
  wadoRsStudyUrl(studyInstanceUID: string): string {
    return `${this.cfg.baseUrl}/dicom-web/studies/${studyInstanceUID}`;
  }
}
