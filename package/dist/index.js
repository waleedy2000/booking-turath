// src/client.ts
var BASE_URL = "https://api.sms-gate.app/3rdparty/v1";

class Client {
  baseUrl;
  httpClient;
  defaultHeaders;
  constructor(login, password, httpClient, baseUrl = BASE_URL) {
    this.baseUrl = baseUrl;
    this.httpClient = httpClient;
    this.defaultHeaders = {
      "User-Agent": "android-sms-gateway/3.0 (client; js)",
      Authorization: `Basic ${btoa(`${login}:${password}`)}`
    };
  }
  async send(request, options) {
    const url = new URL(`${this.baseUrl}/message`);
    if (options?.skipPhoneValidation !== undefined) {
      url.searchParams.append("skipPhoneValidation", options.skipPhoneValidation.toString());
    }
    const headers = {
      "Content-Type": "application/json",
      ...this.defaultHeaders
    };
    return this.httpClient.post(url.toString(), request, headers);
  }
  async getState(messageId) {
    const url = `${this.baseUrl}/message/${messageId}`;
    const headers = {
      ...this.defaultHeaders
    };
    return this.httpClient.get(url, headers);
  }
  async getWebhooks() {
    const url = `${this.baseUrl}/webhooks`;
    const headers = {
      ...this.defaultHeaders
    };
    return this.httpClient.get(url, headers);
  }
  async registerWebhook(request) {
    const url = `${this.baseUrl}/webhooks`;
    const headers = {
      "Content-Type": "application/json",
      ...this.defaultHeaders
    };
    return this.httpClient.post(url, request, headers);
  }
  async deleteWebhook(webhookId) {
    const url = `${this.baseUrl}/webhooks/${webhookId}`;
    const headers = {
      ...this.defaultHeaders
    };
    return this.httpClient.delete(url, headers);
  }
  async getDevices() {
    const url = `${this.baseUrl}/devices`;
    const headers = {
      ...this.defaultHeaders
    };
    return this.httpClient.get(url, headers);
  }
  async deleteDevice(deviceId) {
    const url = `${this.baseUrl}/devices/${deviceId}`;
    const headers = {
      ...this.defaultHeaders
    };
    return this.httpClient.delete(url, headers);
  }
  async getHealth() {
    const url = `${this.baseUrl}/health`;
    const headers = {
      ...this.defaultHeaders
    };
    return this.httpClient.get(url, headers);
  }
  async exportInbox(request) {
    const url = `${this.baseUrl}/inbox/export`;
    const headers = {
      "Content-Type": "application/json",
      ...this.defaultHeaders
    };
    const exportRequest = {
      deviceId: request.deviceId,
      since: request.since.toISOString(),
      until: request.until.toISOString()
    };
    return this.httpClient.post(url, exportRequest, headers);
  }
  async getLogs(from, to) {
    const url = new URL(`${this.baseUrl}/logs`);
    if (from) {
      url.searchParams.append("from", from.toISOString());
    }
    if (to) {
      url.searchParams.append("to", to.toISOString());
    }
    const headers = {
      ...this.defaultHeaders
    };
    return this.httpClient.get(url.toString(), headers);
  }
  async getSettings() {
    const url = `${this.baseUrl}/settings`;
    const headers = {
      ...this.defaultHeaders
    };
    return this.httpClient.get(url, headers);
  }
  async updateSettings(settings) {
    const url = `${this.baseUrl}/settings`;
    const headers = {
      "Content-Type": "application/json",
      ...this.defaultHeaders
    };
    return this.httpClient.put(url, settings, headers);
  }
  async patchSettings(settings) {
    const url = `${this.baseUrl}/settings`;
    const headers = {
      "Content-Type": "application/json",
      ...this.defaultHeaders
    };
    return this.httpClient.patch(url, settings, headers);
  }
}

// src/domain.ts
var ProcessState;
((ProcessState2) => {
  ProcessState2["Pending"] = "Pending";
  ProcessState2["Processed"] = "Processed";
  ProcessState2["Sent"] = "Sent";
  ProcessState2["Delivered"] = "Delivered";
  ProcessState2["Failed"] = "Failed";
})(ProcessState ||= {});
var WebHookEventType;
((WebHookEventType2) => {
  WebHookEventType2["SmsReceived"] = "sms:received";
  WebHookEventType2["SystemPing"] = "system:ping";
  WebHookEventType2["SmsSent"] = "sms:sent";
  WebHookEventType2["SmsDelivered"] = "sms:delivered";
  WebHookEventType2["SmsFailed"] = "sms:failed";
})(WebHookEventType ||= {});
var LimitPeriod;
((LimitPeriod2) => {
  LimitPeriod2["Disabled"] = "Disabled";
  LimitPeriod2["PerMinute"] = "PerMinute";
  LimitPeriod2["PerHour"] = "PerHour";
  LimitPeriod2["PerDay"] = "PerDay";
})(LimitPeriod ||= {});
var SimSelectionMode;
((SimSelectionMode2) => {
  SimSelectionMode2["OSDefault"] = "OSDefault";
  SimSelectionMode2["RoundRobin"] = "RoundRobin";
  SimSelectionMode2["Random"] = "Random";
})(SimSelectionMode ||= {});
var HealthStatus;
((HealthStatus2) => {
  HealthStatus2["Pass"] = "pass";
  HealthStatus2["Warn"] = "warn";
  HealthStatus2["Fail"] = "fail";
})(HealthStatus ||= {});
var LogEntryPriority;
((LogEntryPriority2) => {
  LogEntryPriority2["Debug"] = "DEBUG";
  LogEntryPriority2["Info"] = "INFO";
  LogEntryPriority2["Warn"] = "WARN";
  LogEntryPriority2["Error"] = "ERROR";
})(LogEntryPriority ||= {});

// src/index.ts
var src_default = Client;
export {
  src_default as default,
  WebHookEventType,
  SimSelectionMode,
  ProcessState,
  LogEntryPriority,
  LimitPeriod,
  HealthStatus
};
