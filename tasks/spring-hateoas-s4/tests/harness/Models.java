package bench;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Model types and shared state used by the hidden suites. None of this is product code.
 */
public final class Models {

	private Models() {}

	/** Records writes to a property that must never be written from a document. */
	public static final class Recorder {

		private static int secretWrites;

		private Recorder() {}

		public static void reset() {
			secretWrites = 0;
		}

		public static int secretWrites() {
			return secretWrites;
		}

		static void secretWritten() {
			secretWrites++;
		}
	}

	/** A model with visible and hidden properties plus initialised defaults. */
	public static class Account {

		private String name;
		private boolean admin;
		private String secret = "initial";
		private boolean active = true;
		private int credits = 5;

		public String getName() {
			return name;
		}

		public void setName(String name) {
			this.name = name;
		}

		@JsonIgnore
		public boolean isAdmin() {
			return admin;
		}

		public void setAdmin(boolean admin) {
			this.admin = admin;
		}

		public String getSecret() {
			return secret;
		}

		@JsonIgnore
		public void setSecret(String secret) {
			Recorder.secretWritten();
			this.secret = secret;
		}

		public boolean isActive() {
			return active;
		}

		public void setActive(boolean active) {
			this.active = active;
		}

		public int getCredits() {
			return credits;
		}

		public void setCredits(int credits) {
			this.credits = credits;
		}
	}

	/** A model whose property is exposed under a different name than its accessors use. */
	public static class RenamedAccount {

		private String name;
		private String token = "initial-token";

		public String getName() {
			return name;
		}

		public void setName(String name) {
			this.name = name;
		}

		@JsonProperty("public_token")
		public String getToken() {
			return token;
		}

		public void setToken(String token) {
			this.token = token;
		}
	}

	/** A model that hides one property at class level. */
	@JsonIgnoreProperties("internal")
	public static class GuardedAccount {

		private String name;
		private String internal = "initial-internal";

		public String getName() {
			return name;
		}

		public void setName(String name) {
			this.name = name;
		}

		public String getInternal() {
			return internal;
		}

		public void setInternal(String internal) {
			this.internal = internal;
		}
	}

	/** A model whose hidden property is only declared through a mix-in on the mapper. */
	public static class MixinAccount {

		private String name;
		private boolean flag = true;

		public String getName() {
			return name;
		}

		public void setName(String name) {
			this.name = name;
		}

		public boolean isFlag() {
			return flag;
		}

		public void setFlag(boolean flag) {
			this.flag = flag;
		}
	}

	/** Mix-in hiding the flag property. */
	public interface HideFlagMixin {
		@JsonIgnore
		boolean isFlag();
	}
}
