package com.izforge.izpack.installer.bench.support;

import com.izforge.izpack.api.data.AutomatedInstallData;
import com.izforge.izpack.api.data.Info;
import com.izforge.izpack.api.rules.RulesEngine;
import com.izforge.izpack.core.data.DefaultVariables;
import com.izforge.izpack.installer.data.UninstallData;
import com.izforge.izpack.installer.data.UninstallDataWriter;
import com.izforge.izpack.merge.resolve.PathResolver;
import com.izforge.izpack.util.Platform;

import java.io.File;
import java.io.IOException;
import java.util.ArrayList;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Drives the installer's uninstall-data writer, the step that prepares the removal data and
 * its log once the packs have been installed.
 *
 * <p>The writer is constructed exactly as the installer constructs it, with the compiled
 * installer's information and variables; the test supplies the values it wants the metadata to
 * carry and asserts on the files that appear on disk.</p>
 */
public class WriterFixture
{
    /**
     * Variable the installer reads the location of its external log from.
     */
    public static final String LOG_PATH_VARIABLE = "InstallerFrame.logfilePath";

    private final File root;
    private final File installDir;
    private final Info info = new Info();
    private final AutomatedInstallData installData;
    private final UninstallData uninstallData = new UninstallData();

    public WriterFixture(File root) throws IOException
    {
        this.root = root;
        this.installDir = new File(root, "install");
        if (!installDir.mkdirs() && !installDir.isDirectory())
        {
            throw new IOException("cannot create install directory");
        }
        DefaultVariables variables = new DefaultVariables();
        installData = new AutomatedInstallData(variables, mock(Platform.class));
        installData.setInfo(info);
        installData.setInstallPath(installDir.getAbsolutePath());
    }

    public File root()
    {
        return root;
    }

    public File installDir()
    {
        return installDir;
    }

    /** Sets the directory the uninstaller data is written to, as the compiled metadata carries it. */
    public WriterFixture uninstallerPath(String path)
    {
        info.setUninstallerPath(path);
        return this;
    }

    /** Sets the uninstaller file name, as the compiled metadata carries it. */
    public WriterFixture uninstallerName(String name)
    {
        info.setUninstallerName(name);
        return this;
    }

    /** Registers a variable value, as the compiler's defaults or the user's properties supply it. */
    public WriterFixture variable(String name, String value)
    {
        installData.setVariable(name, value);
        return this;
    }

    /** Records a file as installed, exactly as the unpacker records every entry it installs. */
    public WriterFixture installedFile(File file)
    {
        uninstallData.addFile(file.getAbsolutePath(), true);
        return this;
    }

    /** Runs the writer and returns its result. */
    public boolean write()
    {
        PathResolver resolver = mock(PathResolver.class);
        when(resolver.getMergeableFromPath(anyString())).thenReturn(new ArrayList<>());
        UninstallDataWriter writer = new UninstallDataWriter(uninstallData, installData, resolver,
                                                            mock(RulesEngine.class));
        return writer.write();
    }
}
