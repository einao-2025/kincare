{{/*
Expand the name of the chart.
*/}}
{{- define "kincare.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "kincare.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name (include "kincare.name" .) | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}

{{- define "kincare.labels" -}}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version }}
app.kubernetes.io/name: {{ include "kincare.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: kincare
{{- end -}}

{{- define "kincare.componentLabels" -}}
{{ include "kincare.labels" . }}
app.kubernetes.io/component: {{ .component }}
{{- end -}}

{{- define "kincare.image" -}}
{{- $registry := .Values.global.imageRegistry -}}
{{- $repo := .image.repository -}}
{{- $tag := default (default .Chart.AppVersion .Values.global.imageTag) .image.tag -}}
{{- printf "%s/%s:%s" $registry $repo $tag -}}
{{- end -}}

{{- define "kincare.secretName" -}}
{{- default (printf "%s-secrets" (include "kincare.fullname" .)) .Values.secrets.existingSecret -}}
{{- end -}}

{{- define "kincare.configMapName" -}}
{{- printf "%s-config" (include "kincare.fullname" .) -}}
{{- end -}}
