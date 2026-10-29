# Generated from /home/runner/.tb-graders/cwe/work/hydra-s4/pinned/hydra/grammar/OverrideParser.g4 by ANTLR 4.11.1
# encoding: utf-8
from omegaconf.vendor.antlr4 import *
from io import StringIO
import sys
if sys.version_info[1] > 5:
	from typing import TextIO
else:
	from typing.io import TextIO

def serializedATN():
    return [
        4,1,25,159,2,0,7,0,2,1,7,1,2,2,7,2,2,3,7,3,2,4,7,4,2,5,7,5,2,6,7,
        6,2,7,7,7,2,8,7,8,2,9,7,9,2,10,7,10,2,11,7,11,2,12,7,12,2,13,7,13,
        1,0,1,0,1,0,3,0,32,8,0,1,0,1,0,1,0,1,0,3,0,38,8,0,3,0,40,8,0,1,0,
        1,0,3,0,44,8,0,1,0,1,0,1,0,3,0,49,8,0,3,0,51,8,0,1,0,1,0,1,1,1,1,
        1,1,3,1,58,8,1,1,2,1,2,1,2,1,2,4,2,64,8,2,11,2,12,2,65,3,2,68,8,
        2,1,3,1,3,1,3,1,3,3,3,74,8,3,1,4,1,4,3,4,78,8,4,1,5,1,5,1,5,1,5,
        3,5,84,8,5,1,6,1,6,1,6,4,6,89,8,6,11,6,12,6,90,1,7,1,7,1,7,1,8,1,
        8,1,8,3,8,99,8,8,1,8,1,8,1,8,3,8,104,8,8,1,8,5,8,107,8,8,10,8,12,
        8,110,9,8,3,8,112,8,8,1,8,1,8,1,9,1,9,1,9,1,9,5,9,120,8,9,10,9,12,
        9,123,9,9,3,9,125,8,9,1,9,1,9,1,10,1,10,1,10,1,10,5,10,133,8,10,
        10,10,12,10,136,9,10,3,10,138,8,10,1,10,1,10,1,11,1,11,1,11,1,11,
        1,12,1,12,4,12,148,8,12,11,12,12,12,149,3,12,152,8,12,1,13,4,13,
        155,8,13,11,13,12,13,156,1,13,0,0,14,0,2,4,6,8,10,12,14,16,18,20,
        22,24,26,0,2,3,0,5,5,16,23,25,25,1,0,16,23,173,0,50,1,0,0,0,2,54,
        1,0,0,0,4,67,1,0,0,0,6,73,1,0,0,0,8,77,1,0,0,0,10,83,1,0,0,0,12,
        85,1,0,0,0,14,92,1,0,0,0,16,95,1,0,0,0,18,115,1,0,0,0,20,128,1,0,
        0,0,22,141,1,0,0,0,24,151,1,0,0,0,26,154,1,0,0,0,28,29,3,2,1,0,29,
        31,5,1,0,0,30,32,3,8,4,0,31,30,1,0,0,0,31,32,1,0,0,0,32,51,1,0,0,
        0,33,34,5,2,0,0,34,39,3,2,1,0,35,37,5,1,0,0,36,38,3,8,4,0,37,36,
        1,0,0,0,37,38,1,0,0,0,38,40,1,0,0,0,39,35,1,0,0,0,39,40,1,0,0,0,
        40,51,1,0,0,0,41,43,5,3,0,0,42,44,5,3,0,0,43,42,1,0,0,0,43,44,1,
        0,0,0,44,45,1,0,0,0,45,46,3,2,1,0,46,48,5,1,0,0,47,49,3,8,4,0,48,
        47,1,0,0,0,48,49,1,0,0,0,49,51,1,0,0,0,50,28,1,0,0,0,50,33,1,0,0,
        0,50,41,1,0,0,0,51,52,1,0,0,0,52,53,5,0,0,1,53,1,1,0,0,0,54,57,3,
        4,2,0,55,56,5,4,0,0,56,58,3,6,3,0,57,55,1,0,0,0,57,58,1,0,0,0,58,
        3,1,0,0,0,59,68,3,6,3,0,60,63,5,21,0,0,61,62,5,6,0,0,62,64,5,21,
        0,0,63,61,1,0,0,0,64,65,1,0,0,0,65,63,1,0,0,0,65,66,1,0,0,0,66,68,
        1,0,0,0,67,59,1,0,0,0,67,60,1,0,0,0,68,5,1,0,0,0,69,74,1,0,0,0,70,
        74,5,21,0,0,71,74,5,7,0,0,72,74,5,8,0,0,73,69,1,0,0,0,73,70,1,0,
        0,0,73,71,1,0,0,0,73,72,1,0,0,0,74,7,1,0,0,0,75,78,3,10,5,0,76,78,
        3,12,6,0,77,75,1,0,0,0,77,76,1,0,0,0,78,9,1,0,0,0,79,84,3,24,12,
        0,80,84,3,18,9,0,81,84,3,20,10,0,82,84,3,16,8,0,83,79,1,0,0,0,83,
        80,1,0,0,0,83,81,1,0,0,0,83,82,1,0,0,0,84,11,1,0,0,0,85,88,3,10,
        5,0,86,87,5,10,0,0,87,89,3,10,5,0,88,86,1,0,0,0,89,90,1,0,0,0,90,
        88,1,0,0,0,90,91,1,0,0,0,91,13,1,0,0,0,92,93,5,21,0,0,93,94,5,1,
        0,0,94,15,1,0,0,0,95,96,5,21,0,0,96,111,5,9,0,0,97,99,3,14,7,0,98,
        97,1,0,0,0,98,99,1,0,0,0,99,100,1,0,0,0,100,108,3,10,5,0,101,103,
        5,10,0,0,102,104,3,14,7,0,103,102,1,0,0,0,103,104,1,0,0,0,104,105,
        1,0,0,0,105,107,3,10,5,0,106,101,1,0,0,0,107,110,1,0,0,0,108,106,
        1,0,0,0,108,109,1,0,0,0,109,112,1,0,0,0,110,108,1,0,0,0,111,98,1,
        0,0,0,111,112,1,0,0,0,112,113,1,0,0,0,113,114,5,11,0,0,114,17,1,
        0,0,0,115,124,5,12,0,0,116,121,3,10,5,0,117,118,5,10,0,0,118,120,
        3,10,5,0,119,117,1,0,0,0,120,123,1,0,0,0,121,119,1,0,0,0,121,122,
        1,0,0,0,122,125,1,0,0,0,123,121,1,0,0,0,124,116,1,0,0,0,124,125,
        1,0,0,0,125,126,1,0,0,0,126,127,5,13,0,0,127,19,1,0,0,0,128,137,
        5,14,0,0,129,134,3,22,11,0,130,131,5,10,0,0,131,133,3,22,11,0,132,
        130,1,0,0,0,133,136,1,0,0,0,134,132,1,0,0,0,134,135,1,0,0,0,135,
        138,1,0,0,0,136,134,1,0,0,0,137,129,1,0,0,0,137,138,1,0,0,0,138,
        139,1,0,0,0,139,140,5,15,0,0,140,21,1,0,0,0,141,142,3,26,13,0,142,
        143,5,5,0,0,143,144,3,10,5,0,144,23,1,0,0,0,145,152,5,24,0,0,146,
        148,7,0,0,0,147,146,1,0,0,0,148,149,1,0,0,0,149,147,1,0,0,0,149,
        150,1,0,0,0,150,152,1,0,0,0,151,145,1,0,0,0,151,147,1,0,0,0,152,
        25,1,0,0,0,153,155,7,1,0,0,154,153,1,0,0,0,155,156,1,0,0,0,156,154,
        1,0,0,0,156,157,1,0,0,0,157,27,1,0,0,0,24,31,37,39,43,48,50,57,65,
        67,73,77,83,90,98,103,108,111,121,124,134,137,149,151,156
    ]

class OverrideParser ( Parser ):

    grammarFileName = "OverrideParser.g4"

    atn = ATNDeserializer().deserialize(serializedATN())

    decisionsToDFA = [ DFA(ds, i) for i, ds in enumerate(atn.decisionToState) ]

    sharedContextCache = PredictionContextCache()

    literalNames = [ "<INVALID>", "<INVALID>", "'~'", "'+'", "'@'", "':'", 
                     "'/'" ]

    symbolicNames = [ "<INVALID>", "EQUAL", "TILDE", "PLUS", "AT", "COLON", 
                      "SLASH", "KEY_SPECIAL", "DOT_PATH", "POPEN", "COMMA", 
                      "PCLOSE", "BRACKET_OPEN", "BRACKET_CLOSE", "BRACE_OPEN", 
                      "BRACE_CLOSE", "FLOAT", "INT", "BOOL", "NULL", "UNQUOTED_CHAR", 
                      "ID", "ESC", "WS", "QUOTED_VALUE", "INTERPOLATION" ]

    RULE_override = 0
    RULE_key = 1
    RULE_packageOrGroup = 2
    RULE_package = 3
    RULE_value = 4
    RULE_element = 5
    RULE_simpleChoiceSweep = 6
    RULE_argName = 7
    RULE_function = 8
    RULE_listContainer = 9
    RULE_dictContainer = 10
    RULE_dictKeyValuePair = 11
    RULE_primitive = 12
    RULE_dictKey = 13

    ruleNames =  [ "override", "key", "packageOrGroup", "package", "value", 
                   "element", "simpleChoiceSweep", "argName", "function", 
                   "listContainer", "dictContainer", "dictKeyValuePair", 
                   "primitive", "dictKey" ]

    EOF = Token.EOF
    EQUAL=1
    TILDE=2
    PLUS=3
    AT=4
    COLON=5
    SLASH=6
    KEY_SPECIAL=7
    DOT_PATH=8
    POPEN=9
    COMMA=10
    PCLOSE=11
    BRACKET_OPEN=12
    BRACKET_CLOSE=13
    BRACE_OPEN=14
    BRACE_CLOSE=15
    FLOAT=16
    INT=17
    BOOL=18
    NULL=19
    UNQUOTED_CHAR=20
    ID=21
    ESC=22
    WS=23
    QUOTED_VALUE=24
    INTERPOLATION=25

    def __init__(self, input:TokenStream, output:TextIO = sys.stdout):
        super().__init__(input, output)
        self.checkVersion("4.11.1")
        self._interp = ParserATNSimulator(self, self.atn, self.decisionsToDFA, self.sharedContextCache)
        self._predicates = None




    class OverrideContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def EOF(self):
            return self.getToken(OverrideParser.EOF, 0)

        def key(self):
            return self.getTypedRuleContext(OverrideParser.KeyContext,0)


        def EQUAL(self):
            return self.getToken(OverrideParser.EQUAL, 0)

        def TILDE(self):
            return self.getToken(OverrideParser.TILDE, 0)

        def PLUS(self, i:int=None):
            if i is None:
                return self.getTokens(OverrideParser.PLUS)
            else:
                return self.getToken(OverrideParser.PLUS, i)

        def value(self):
            return self.getTypedRuleContext(OverrideParser.ValueContext,0)


        def getRuleIndex(self):
            return OverrideParser.RULE_override

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterOverride" ):
                listener.enterOverride(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitOverride" ):
                listener.exitOverride(self)

        def accept(self, visitor:ParseTreeVisitor):
            if hasattr( visitor, "visitOverride" ):
                return visitor.visitOverride(self)
            else:
                return visitor.visitChildren(self)




    def override(self):

        localctx = OverrideParser.OverrideContext(self, self._ctx, self.state)
        self.enterRule(localctx, 0, self.RULE_override)
        self._la = 0 # Token type
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 50
            self._errHandler.sync(self)
            token = self._input.LA(1)
            if token in [1, 4, 7, 8, 21]:
                self.state = 28
                self.key()
                self.state = 29
                self.match(OverrideParser.EQUAL)
                self.state = 31
                self._errHandler.sync(self)
                _la = self._input.LA(1)
                if ((_la) & ~0x3f) == 0 and ((1 << _la) & 67063840) != 0:
                    self.state = 30
                    self.value()


                pass
            elif token in [2]:
                self.state = 33
                self.match(OverrideParser.TILDE)
                self.state = 34
                self.key()
                self.state = 39
                self._errHandler.sync(self)
                _la = self._input.LA(1)
                if _la==1:
                    self.state = 35
                    self.match(OverrideParser.EQUAL)
                    self.state = 37
                    self._errHandler.sync(self)
                    _la = self._input.LA(1)
                    if ((_la) & ~0x3f) == 0 and ((1 << _la) & 67063840) != 0:
                        self.state = 36
                        self.value()




                pass
            elif token in [3]:
                self.state = 41
                self.match(OverrideParser.PLUS)
                self.state = 43
                self._errHandler.sync(self)
                _la = self._input.LA(1)
                if _la==3:
                    self.state = 42
                    self.match(OverrideParser.PLUS)


                self.state = 45
                self.key()
                self.state = 46
                self.match(OverrideParser.EQUAL)
                self.state = 48
                self._errHandler.sync(self)
                _la = self._input.LA(1)
                if ((_la) & ~0x3f) == 0 and ((1 << _la) & 67063840) != 0:
                    self.state = 47
                    self.value()


                pass
            else:
                raise NoViableAltException(self)

            self.state = 52
            self.match(OverrideParser.EOF)
        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class KeyContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def packageOrGroup(self):
            return self.getTypedRuleContext(OverrideParser.PackageOrGroupContext,0)


        def AT(self):
            return self.getToken(OverrideParser.AT, 0)

        def package(self):
            return self.getTypedRuleContext(OverrideParser.PackageContext,0)


        def getRuleIndex(self):
            return OverrideParser.RULE_key

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterKey" ):
                listener.enterKey(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitKey" ):
                listener.exitKey(self)

        def accept(self, visitor:ParseTreeVisitor):
            if hasattr( visitor, "visitKey" ):
                return visitor.visitKey(self)
            else:
                return visitor.visitChildren(self)




    def key(self):

        localctx = OverrideParser.KeyContext(self, self._ctx, self.state)
        self.enterRule(localctx, 2, self.RULE_key)
        self._la = 0 # Token type
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 54
            self.packageOrGroup()
            self.state = 57
            self._errHandler.sync(self)
            _la = self._input.LA(1)
            if _la==4:
                self.state = 55
                self.match(OverrideParser.AT)
                self.state = 56
                self.package()


        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class PackageOrGroupContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def package(self):
            return self.getTypedRuleContext(OverrideParser.PackageContext,0)


        def ID(self, i:int=None):
            if i is None:
                return self.getTokens(OverrideParser.ID)
            else:
                return self.getToken(OverrideParser.ID, i)

        def SLASH(self, i:int=None):
            if i is None:
                return self.getTokens(OverrideParser.SLASH)
            else:
                return self.getToken(OverrideParser.SLASH, i)

        def getRuleIndex(self):
            return OverrideParser.RULE_packageOrGroup

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterPackageOrGroup" ):
                listener.enterPackageOrGroup(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitPackageOrGroup" ):
                listener.exitPackageOrGroup(self)

        def accept(self, visitor:ParseTreeVisitor):
            if hasattr( visitor, "visitPackageOrGroup" ):
                return visitor.visitPackageOrGroup(self)
            else:
                return visitor.visitChildren(self)




    def packageOrGroup(self):

        localctx = OverrideParser.PackageOrGroupContext(self, self._ctx, self.state)
        self.enterRule(localctx, 4, self.RULE_packageOrGroup)
        self._la = 0 # Token type
        try:
            self.state = 67
            self._errHandler.sync(self)
            la_ = self._interp.adaptivePredict(self._input,8,self._ctx)
            if la_ == 1:
                self.enterOuterAlt(localctx, 1)
                self.state = 59
                self.package()
                pass

            elif la_ == 2:
                self.enterOuterAlt(localctx, 2)
                self.state = 60
                self.match(OverrideParser.ID)
                self.state = 63 
                self._errHandler.sync(self)
                _la = self._input.LA(1)
                while True:
                    self.state = 61
                    self.match(OverrideParser.SLASH)
                    self.state = 62
                    self.match(OverrideParser.ID)
                    self.state = 65 
                    self._errHandler.sync(self)
                    _la = self._input.LA(1)
                    if not (_la==6):
                        break

                pass


        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class PackageContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def ID(self):
            return self.getToken(OverrideParser.ID, 0)

        def KEY_SPECIAL(self):
            return self.getToken(OverrideParser.KEY_SPECIAL, 0)

        def DOT_PATH(self):
            return self.getToken(OverrideParser.DOT_PATH, 0)

        def getRuleIndex(self):
            return OverrideParser.RULE_package

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterPackage" ):
                listener.enterPackage(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitPackage" ):
                listener.exitPackage(self)

        def accept(self, visitor:ParseTreeVisitor):
            if hasattr( visitor, "visitPackage" ):
                return visitor.visitPackage(self)
            else:
                return visitor.visitChildren(self)




    def package(self):

        localctx = OverrideParser.PackageContext(self, self._ctx, self.state)
        self.enterRule(localctx, 6, self.RULE_package)
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 73
            self._errHandler.sync(self)
            token = self._input.LA(1)
            if token in [-1, 1, 4]:
                pass
            elif token in [21]:
                self.state = 70
                self.match(OverrideParser.ID)
                pass
            elif token in [7]:
                self.state = 71
                self.match(OverrideParser.KEY_SPECIAL)
                pass
            elif token in [8]:
                self.state = 72
                self.match(OverrideParser.DOT_PATH)
                pass
            else:
                raise NoViableAltException(self)

        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class ValueContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def element(self):
            return self.getTypedRuleContext(OverrideParser.ElementContext,0)


        def simpleChoiceSweep(self):
            return self.getTypedRuleContext(OverrideParser.SimpleChoiceSweepContext,0)


        def getRuleIndex(self):
            return OverrideParser.RULE_value

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterValue" ):
                listener.enterValue(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitValue" ):
                listener.exitValue(self)

        def accept(self, visitor:ParseTreeVisitor):
            if hasattr( visitor, "visitValue" ):
                return visitor.visitValue(self)
            else:
                return visitor.visitChildren(self)




    def value(self):

        localctx = OverrideParser.ValueContext(self, self._ctx, self.state)
        self.enterRule(localctx, 8, self.RULE_value)
        try:
            self.state = 77
            self._errHandler.sync(self)
            la_ = self._interp.adaptivePredict(self._input,10,self._ctx)
            if la_ == 1:
                self.enterOuterAlt(localctx, 1)
                self.state = 75
                self.element()
                pass

            elif la_ == 2:
                self.enterOuterAlt(localctx, 2)
                self.state = 76
                self.simpleChoiceSweep()
                pass


        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class ElementContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def primitive(self):
            return self.getTypedRuleContext(OverrideParser.PrimitiveContext,0)


        def listContainer(self):
            return self.getTypedRuleContext(OverrideParser.ListContainerContext,0)


        def dictContainer(self):
            return self.getTypedRuleContext(OverrideParser.DictContainerContext,0)


        def function(self):
            return self.getTypedRuleContext(OverrideParser.FunctionContext,0)


        def getRuleIndex(self):
            return OverrideParser.RULE_element

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterElement" ):
                listener.enterElement(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitElement" ):
                listener.exitElement(self)

        def accept(self, visitor:ParseTreeVisitor):
            if hasattr( visitor, "visitElement" ):
                return visitor.visitElement(self)
            else:
                return visitor.visitChildren(self)




    def element(self):

        localctx = OverrideParser.ElementContext(self, self._ctx, self.state)
        self.enterRule(localctx, 10, self.RULE_element)
        try:
            self.state = 83
            self._errHandler.sync(self)
            la_ = self._interp.adaptivePredict(self._input,11,self._ctx)
            if la_ == 1:
                self.enterOuterAlt(localctx, 1)
                self.state = 79
                self.primitive()
                pass

            elif la_ == 2:
                self.enterOuterAlt(localctx, 2)
                self.state = 80
                self.listContainer()
                pass

            elif la_ == 3:
                self.enterOuterAlt(localctx, 3)
                self.state = 81
                self.dictContainer()
                pass

            elif la_ == 4:
                self.enterOuterAlt(localctx, 4)
                self.state = 82
                self.function()
                pass


        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class SimpleChoiceSweepContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def element(self, i:int=None):
            if i is None:
                return self.getTypedRuleContexts(OverrideParser.ElementContext)
            else:
                return self.getTypedRuleContext(OverrideParser.ElementContext,i)


        def COMMA(self, i:int=None):
            if i is None:
                return self.getTokens(OverrideParser.COMMA)
            else:
                return self.getToken(OverrideParser.COMMA, i)

        def getRuleIndex(self):
            return OverrideParser.RULE_simpleChoiceSweep

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterSimpleChoiceSweep" ):
                listener.enterSimpleChoiceSweep(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitSimpleChoiceSweep" ):
                listener.exitSimpleChoiceSweep(self)

        def accept(self, visitor:ParseTreeVisitor):
            if hasattr( visitor, "visitSimpleChoiceSweep" ):
                return visitor.visitSimpleChoiceSweep(self)
            else:
                return visitor.visitChildren(self)




    def simpleChoiceSweep(self):

        localctx = OverrideParser.SimpleChoiceSweepContext(self, self._ctx, self.state)
        self.enterRule(localctx, 12, self.RULE_simpleChoiceSweep)
        self._la = 0 # Token type
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 85
            self.element()
            self.state = 88 
            self._errHandler.sync(self)
            _la = self._input.LA(1)
            while True:
                self.state = 86
                self.match(OverrideParser.COMMA)
                self.state = 87
                self.element()
                self.state = 90 
                self._errHandler.sync(self)
                _la = self._input.LA(1)
                if not (_la==10):
                    break

        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class ArgNameContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def ID(self):
            return self.getToken(OverrideParser.ID, 0)

        def EQUAL(self):
            return self.getToken(OverrideParser.EQUAL, 0)

        def getRuleIndex(self):
            return OverrideParser.RULE_argName

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterArgName" ):
                listener.enterArgName(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitArgName" ):
                listener.exitArgName(self)

        def accept(self, visitor:ParseTreeVisitor):
            if hasattr( visitor, "visitArgName" ):
                return visitor.visitArgName(self)
            else:
                return visitor.visitChildren(self)




    def argName(self):

        localctx = OverrideParser.ArgNameContext(self, self._ctx, self.state)
        self.enterRule(localctx, 14, self.RULE_argName)
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 92
            self.match(OverrideParser.ID)
            self.state = 93
            self.match(OverrideParser.EQUAL)
        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class FunctionContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def ID(self):
            return self.getToken(OverrideParser.ID, 0)

        def POPEN(self):
            return self.getToken(OverrideParser.POPEN, 0)

        def PCLOSE(self):
            return self.getToken(OverrideParser.PCLOSE, 0)

        def element(self, i:int=None):
            if i is None:
                return self.getTypedRuleContexts(OverrideParser.ElementContext)
            else:
                return self.getTypedRuleContext(OverrideParser.ElementContext,i)


        def argName(self, i:int=None):
            if i is None:
                return self.getTypedRuleContexts(OverrideParser.ArgNameContext)
            else:
                return self.getTypedRuleContext(OverrideParser.ArgNameContext,i)


        def COMMA(self, i:int=None):
            if i is None:
                return self.getTokens(OverrideParser.COMMA)
            else:
                return self.getToken(OverrideParser.COMMA, i)

        def getRuleIndex(self):
            return OverrideParser.RULE_function

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterFunction" ):
                listener.enterFunction(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitFunction" ):
                listener.exitFunction(self)

        def accept(self, visitor:ParseTreeVisitor):
            if hasattr( visitor, "visitFunction" ):
                return visitor.visitFunction(self)
            else:
                return visitor.visitChildren(self)




    def function(self):

        localctx = OverrideParser.FunctionContext(self, self._ctx, self.state)
        self.enterRule(localctx, 16, self.RULE_function)
        self._la = 0 # Token type
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 95
            self.match(OverrideParser.ID)
            self.state = 96
            self.match(OverrideParser.POPEN)
            self.state = 111
            self._errHandler.sync(self)
            _la = self._input.LA(1)
            if ((_la) & ~0x3f) == 0 and ((1 << _la) & 67063840) != 0:
                self.state = 98
                self._errHandler.sync(self)
                la_ = self._interp.adaptivePredict(self._input,13,self._ctx)
                if la_ == 1:
                    self.state = 97
                    self.argName()


                self.state = 100
                self.element()
                self.state = 108
                self._errHandler.sync(self)
                _la = self._input.LA(1)
                while _la==10:
                    self.state = 101
                    self.match(OverrideParser.COMMA)
                    self.state = 103
                    self._errHandler.sync(self)
                    la_ = self._interp.adaptivePredict(self._input,14,self._ctx)
                    if la_ == 1:
                        self.state = 102
                        self.argName()


                    self.state = 105
                    self.element()
                    self.state = 110
                    self._errHandler.sync(self)
                    _la = self._input.LA(1)



            self.state = 113
            self.match(OverrideParser.PCLOSE)
        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class ListContainerContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def BRACKET_OPEN(self):
            return self.getToken(OverrideParser.BRACKET_OPEN, 0)

        def BRACKET_CLOSE(self):
            return self.getToken(OverrideParser.BRACKET_CLOSE, 0)

        def element(self, i:int=None):
            if i is None:
                return self.getTypedRuleContexts(OverrideParser.ElementContext)
            else:
                return self.getTypedRuleContext(OverrideParser.ElementContext,i)


        def COMMA(self, i:int=None):
            if i is None:
                return self.getTokens(OverrideParser.COMMA)
            else:
                return self.getToken(OverrideParser.COMMA, i)

        def getRuleIndex(self):
            return OverrideParser.RULE_listContainer

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterListContainer" ):
                listener.enterListContainer(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitListContainer" ):
                listener.exitListContainer(self)

        def accept(self, visitor:ParseTreeVisitor):
            if hasattr( visitor, "visitListContainer" ):
                return visitor.visitListContainer(self)
            else:
                return visitor.visitChildren(self)




    def listContainer(self):

        localctx = OverrideParser.ListContainerContext(self, self._ctx, self.state)
        self.enterRule(localctx, 18, self.RULE_listContainer)
        self._la = 0 # Token type
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 115
            self.match(OverrideParser.BRACKET_OPEN)
            self.state = 124
            self._errHandler.sync(self)
            _la = self._input.LA(1)
            if ((_la) & ~0x3f) == 0 and ((1 << _la) & 67063840) != 0:
                self.state = 116
                self.element()
                self.state = 121
                self._errHandler.sync(self)
                _la = self._input.LA(1)
                while _la==10:
                    self.state = 117
                    self.match(OverrideParser.COMMA)
                    self.state = 118
                    self.element()
                    self.state = 123
                    self._errHandler.sync(self)
                    _la = self._input.LA(1)



            self.state = 126
            self.match(OverrideParser.BRACKET_CLOSE)
        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class DictContainerContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def BRACE_OPEN(self):
            return self.getToken(OverrideParser.BRACE_OPEN, 0)

        def BRACE_CLOSE(self):
            return self.getToken(OverrideParser.BRACE_CLOSE, 0)

        def dictKeyValuePair(self, i:int=None):
            if i is None:
                return self.getTypedRuleContexts(OverrideParser.DictKeyValuePairContext)
            else:
                return self.getTypedRuleContext(OverrideParser.DictKeyValuePairContext,i)


        def COMMA(self, i:int=None):
            if i is None:
                return self.getTokens(OverrideParser.COMMA)
            else:
                return self.getToken(OverrideParser.COMMA, i)

        def getRuleIndex(self):
            return OverrideParser.RULE_dictContainer

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterDictContainer" ):
                listener.enterDictContainer(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitDictContainer" ):
                listener.exitDictContainer(self)

        def accept(self, visitor:ParseTreeVisitor):
            if hasattr( visitor, "visitDictContainer" ):
                return visitor.visitDictContainer(self)
            else:
                return visitor.visitChildren(self)




    def dictContainer(self):

        localctx = OverrideParser.DictContainerContext(self, self._ctx, self.state)
        self.enterRule(localctx, 20, self.RULE_dictContainer)
        self._la = 0 # Token type
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 128
            self.match(OverrideParser.BRACE_OPEN)
            self.state = 137
            self._errHandler.sync(self)
            _la = self._input.LA(1)
            if ((_la) & ~0x3f) == 0 and ((1 << _la) & 16711680) != 0:
                self.state = 129
                self.dictKeyValuePair()
                self.state = 134
                self._errHandler.sync(self)
                _la = self._input.LA(1)
                while _la==10:
                    self.state = 130
                    self.match(OverrideParser.COMMA)
                    self.state = 131
                    self.dictKeyValuePair()
                    self.state = 136
                    self._errHandler.sync(self)
                    _la = self._input.LA(1)



            self.state = 139
            self.match(OverrideParser.BRACE_CLOSE)
        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class DictKeyValuePairContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def dictKey(self):
            return self.getTypedRuleContext(OverrideParser.DictKeyContext,0)


        def COLON(self):
            return self.getToken(OverrideParser.COLON, 0)

        def element(self):
            return self.getTypedRuleContext(OverrideParser.ElementContext,0)


        def getRuleIndex(self):
            return OverrideParser.RULE_dictKeyValuePair

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterDictKeyValuePair" ):
                listener.enterDictKeyValuePair(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitDictKeyValuePair" ):
                listener.exitDictKeyValuePair(self)

        def accept(self, visitor:ParseTreeVisitor):
            if hasattr( visitor, "visitDictKeyValuePair" ):
                return visitor.visitDictKeyValuePair(self)
            else:
                return visitor.visitChildren(self)




    def dictKeyValuePair(self):

        localctx = OverrideParser.DictKeyValuePairContext(self, self._ctx, self.state)
        self.enterRule(localctx, 22, self.RULE_dictKeyValuePair)
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 141
            self.dictKey()
            self.state = 142
            self.match(OverrideParser.COLON)
            self.state = 143
            self.element()
        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class PrimitiveContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def QUOTED_VALUE(self):
            return self.getToken(OverrideParser.QUOTED_VALUE, 0)

        def ID(self, i:int=None):
            if i is None:
                return self.getTokens(OverrideParser.ID)
            else:
                return self.getToken(OverrideParser.ID, i)

        def NULL(self, i:int=None):
            if i is None:
                return self.getTokens(OverrideParser.NULL)
            else:
                return self.getToken(OverrideParser.NULL, i)

        def INT(self, i:int=None):
            if i is None:
                return self.getTokens(OverrideParser.INT)
            else:
                return self.getToken(OverrideParser.INT, i)

        def FLOAT(self, i:int=None):
            if i is None:
                return self.getTokens(OverrideParser.FLOAT)
            else:
                return self.getToken(OverrideParser.FLOAT, i)

        def BOOL(self, i:int=None):
            if i is None:
                return self.getTokens(OverrideParser.BOOL)
            else:
                return self.getToken(OverrideParser.BOOL, i)

        def INTERPOLATION(self, i:int=None):
            if i is None:
                return self.getTokens(OverrideParser.INTERPOLATION)
            else:
                return self.getToken(OverrideParser.INTERPOLATION, i)

        def UNQUOTED_CHAR(self, i:int=None):
            if i is None:
                return self.getTokens(OverrideParser.UNQUOTED_CHAR)
            else:
                return self.getToken(OverrideParser.UNQUOTED_CHAR, i)

        def COLON(self, i:int=None):
            if i is None:
                return self.getTokens(OverrideParser.COLON)
            else:
                return self.getToken(OverrideParser.COLON, i)

        def ESC(self, i:int=None):
            if i is None:
                return self.getTokens(OverrideParser.ESC)
            else:
                return self.getToken(OverrideParser.ESC, i)

        def WS(self, i:int=None):
            if i is None:
                return self.getTokens(OverrideParser.WS)
            else:
                return self.getToken(OverrideParser.WS, i)

        def getRuleIndex(self):
            return OverrideParser.RULE_primitive

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterPrimitive" ):
                listener.enterPrimitive(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitPrimitive" ):
                listener.exitPrimitive(self)

        def accept(self, visitor:ParseTreeVisitor):
            if hasattr( visitor, "visitPrimitive" ):
                return visitor.visitPrimitive(self)
            else:
                return visitor.visitChildren(self)




    def primitive(self):

        localctx = OverrideParser.PrimitiveContext(self, self._ctx, self.state)
        self.enterRule(localctx, 24, self.RULE_primitive)
        self._la = 0 # Token type
        try:
            self.state = 151
            self._errHandler.sync(self)
            token = self._input.LA(1)
            if token in [24]:
                self.enterOuterAlt(localctx, 1)
                self.state = 145
                self.match(OverrideParser.QUOTED_VALUE)
                pass
            elif token in [5, 16, 17, 18, 19, 20, 21, 22, 23, 25]:
                self.enterOuterAlt(localctx, 2)
                self.state = 147 
                self._errHandler.sync(self)
                _la = self._input.LA(1)
                while True:
                    self.state = 146
                    _la = self._input.LA(1)
                    if not(((_la) & ~0x3f) == 0 and ((1 << _la) & 50266144) != 0):
                        self._errHandler.recoverInline(self)
                    else:
                        self._errHandler.reportMatch(self)
                        self.consume()
                    self.state = 149 
                    self._errHandler.sync(self)
                    _la = self._input.LA(1)
                    if not (((_la) & ~0x3f) == 0 and ((1 << _la) & 50266144) != 0):
                        break

                pass
            else:
                raise NoViableAltException(self)

        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class DictKeyContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def ID(self, i:int=None):
            if i is None:
                return self.getTokens(OverrideParser.ID)
            else:
                return self.getToken(OverrideParser.ID, i)

        def NULL(self, i:int=None):
            if i is None:
                return self.getTokens(OverrideParser.NULL)
            else:
                return self.getToken(OverrideParser.NULL, i)

        def INT(self, i:int=None):
            if i is None:
                return self.getTokens(OverrideParser.INT)
            else:
                return self.getToken(OverrideParser.INT, i)

        def FLOAT(self, i:int=None):
            if i is None:
                return self.getTokens(OverrideParser.FLOAT)
            else:
                return self.getToken(OverrideParser.FLOAT, i)

        def BOOL(self, i:int=None):
            if i is None:
                return self.getTokens(OverrideParser.BOOL)
            else:
                return self.getToken(OverrideParser.BOOL, i)

        def UNQUOTED_CHAR(self, i:int=None):
            if i is None:
                return self.getTokens(OverrideParser.UNQUOTED_CHAR)
            else:
                return self.getToken(OverrideParser.UNQUOTED_CHAR, i)

        def ESC(self, i:int=None):
            if i is None:
                return self.getTokens(OverrideParser.ESC)
            else:
                return self.getToken(OverrideParser.ESC, i)

        def WS(self, i:int=None):
            if i is None:
                return self.getTokens(OverrideParser.WS)
            else:
                return self.getToken(OverrideParser.WS, i)

        def getRuleIndex(self):
            return OverrideParser.RULE_dictKey

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterDictKey" ):
                listener.enterDictKey(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitDictKey" ):
                listener.exitDictKey(self)

        def accept(self, visitor:ParseTreeVisitor):
            if hasattr( visitor, "visitDictKey" ):
                return visitor.visitDictKey(self)
            else:
                return visitor.visitChildren(self)




    def dictKey(self):

        localctx = OverrideParser.DictKeyContext(self, self._ctx, self.state)
        self.enterRule(localctx, 26, self.RULE_dictKey)
        self._la = 0 # Token type
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 154 
            self._errHandler.sync(self)
            _la = self._input.LA(1)
            while True:
                self.state = 153
                _la = self._input.LA(1)
                if not(((_la) & ~0x3f) == 0 and ((1 << _la) & 16711680) != 0):
                    self._errHandler.recoverInline(self)
                else:
                    self._errHandler.reportMatch(self)
                    self.consume()
                self.state = 156 
                self._errHandler.sync(self)
                _la = self._input.LA(1)
                if not (((_la) & ~0x3f) == 0 and ((1 << _la) & 16711680) != 0):
                    break

        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx





