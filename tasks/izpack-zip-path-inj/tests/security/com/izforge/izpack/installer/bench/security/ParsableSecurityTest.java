package com.izforge.izpack.installer.bench.security;

import com.izforge.izpack.api.data.Blockable;
import com.izforge.izpack.api.data.OverrideType;
import com.izforge.izpack.api.data.PackInfo;
import com.izforge.izpack.api.data.ParsableFile;
import com.izforge.izpack.installer.bench.support.InstallerFixture;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.Collections;

import static org.junit.Assert.assertEquals;

/**
 * A file-to-rewrite location carried by compiled metadata must not rewrite a file outside the
 * installation directory.
 */
public class ParsableSecurityTest
{
    @Rule
    public TemporaryFolder tmp = new TemporaryFolder();

    @Test
    public void fileOutsideInstallDirectoryIsNotRewritten() throws Exception
    {
        InstallerFixture fixture = new InstallerFixture(tmp);
        File src = InstallerFixture.source("parsesrc", "owned");
        PackInfo pack = fixture.pack("pack1", false);
        pack.addFile(src.getParentFile(), src, "${INSTALL_PATH}/ok.txt", null, OverrideType.OVERRIDE_TRUE,
                     null, Blockable.BLOCKABLE_NONE, null, null, null);
        ParsableFile parsable = new ParsableFile("${INSTALL_PATH}/ok.txt", null, null,
                                                 Collections.emptyList());
        pack.addParsable(parsable);
        // Model crafted metadata: set the traversing path only after the description has
        // accepted the entry, so a build-time refusal and an install-time refusal both pass.
        InstallerFixture.field(parsable, "path", "${INSTALL_PATH}/../outside.txt");
        fixture.prepare(Collections.singletonList(pack));

        File outside = new File(fixture.root(), "outside.txt");
        Files.write(outside.toPath(), "ORIGINAL".getBytes(StandardCharsets.UTF_8));

        fixture.unpacker().run();

        assertEquals("ORIGINAL",
                     new String(Files.readAllBytes(outside.toPath()), StandardCharsets.UTF_8));
    }
}
