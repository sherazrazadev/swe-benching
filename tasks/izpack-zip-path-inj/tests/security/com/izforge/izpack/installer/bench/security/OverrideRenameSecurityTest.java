package com.izforge.izpack.installer.bench.security;

import com.izforge.izpack.api.data.Blockable;
import com.izforge.izpack.api.data.OverrideType;
import com.izforge.izpack.api.data.PackFile;
import com.izforge.izpack.api.data.PackInfo;
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
 * A rename destination carried by compiled metadata must not move or delete an existing file
 * outside the installation directory.
 */
public class OverrideRenameSecurityTest
{
    @Rule
    public TemporaryFolder tmp = new TemporaryFolder();

    @Test
    public void existingFileOutsideInstallDirectoryIsNotTouched() throws Exception
    {
        InstallerFixture fixture = new InstallerFixture(tmp);
        fixture.payload("owned");
        File src = InstallerFixture.source("renamesrc", "owned");
        PackInfo pack = fixture.pack("pack1", false);
        pack.addFile(src.getParentFile(), src, "${INSTALL_PATH}/target.txt", null, OverrideType.OVERRIDE_TRUE,
                     null, Blockable.BLOCKABLE_NONE, null, null, null);
        PackFile file = pack.getPackFiles().iterator().next();
        InstallerFixture.field(file, "overrideRenameTo", "../escape/");
        fixture.prepare(Collections.singletonList(pack));

        File existing = new File(fixture.installDir(), "target.txt");
        Files.write(existing.toPath(), "old".getBytes(StandardCharsets.UTF_8));
        File escapeDir = new File(fixture.root(), "escape");
        if (!escapeDir.mkdirs() && !escapeDir.isDirectory())
        {
            throw new java.io.IOException("cannot create outside directory");
        }
        File sentinel = new File(escapeDir, "target.txt");
        Files.write(sentinel.toPath(), "SENTINEL".getBytes(StandardCharsets.UTF_8));

        fixture.unpacker().run();

        assertEquals("SENTINEL",
                     new String(Files.readAllBytes(sentinel.toPath()), StandardCharsets.UTF_8));
    }
}
